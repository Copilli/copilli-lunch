const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Student = require('../models/Student');
const { verifyToken, allowRoles } = require('../middleware/auth');
const { sendPaymentEmail } = require('../utils/sendPaymentEmail');

// 📌 Obtener pagos (filtros opcionales)
router.get('/', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const { studentId, from, to } = req.query;
    const filter = {};

    if (studentId) filter.studentId = studentId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const payments = await Payment.find(filter)
      .populate('tokenMovementId')
      .sort({ date: -1 });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({ total, count: payments.length, payments });
  } catch (err) {
    console.error('[❌ Payments GET ERROR]', err);
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

// 📌 Listar pagos con correo pendiente
router.get('/pending-mails', verifyToken, allowRoles('admin'), async (_req, res) => {
  try {
    const pending = await Payment.find({ sentEmail: false }).sort({ date: -1 });
    res.json({ count: pending.length, payments: pending });
  } catch (err) {
    console.error('[❌ Pending Mails ERROR]', err);
    res.status(500).json({ error: 'Error al obtener pagos con correos pendientes' });
  }
});

// 📌 Reenviar correos de pagos con sentEmail=false (opcionalmente filtrado)
router.post('/resend-mails', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const { from, to, studentId, limit } = req.body || {};
    const filter = { sentEmail: false };

    if (studentId) filter.studentId = studentId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    let query = Payment.find(filter).sort({ date: 1 }); // más antiguos primero
    if (limit && Number.isInteger(limit) && limit > 0) {
      query = query.limit(limit);
    }
    const pending = await query.lean();

    const results = {
      totalPending: pending.length,
      attempted: 0,
      sent: 0,
      skippedNoEmail: 0,
      errors: []
    };

    for (const pay of pending) {
      results.attempted += 1;

      // Buscar estudiante para tener nombre y email
      const student = await Student.findOne({ studentId: pay.studentId }).lean();
      if (!student || !student.email) {
        results.skippedNoEmail += 1;
        continue;
      }

      try {
        // Recargar Payment como doc para actualizar sentEmail
        const paymentDoc = await Payment.findById(pay._id);
        await sendPaymentEmail(student, paymentDoc, 'MXN');
        if (paymentDoc.sentEmail) results.sent += 1;
      } catch (e) {
        results.errors.push({
          paymentId: String(pay._id),
          studentId: pay.studentId,
          message: e?.message || 'Email send error'
        });
      }
    }

    res.json(results);
  } catch (err) {
    console.error('[❌ Resend Mails ERROR]', err);
    res.status(500).json({ error: 'Error al reenviar correos pendientes' });
  }
});

// 📊 Resumen de pagos para dashboard (por día o por alumno)
router.get('/summary', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const {
      groupBy = 'day',               // 'day' | 'student'
      from,                          // 'YYYY-MM-DD'
      to,                            // 'YYYY-MM-DD'
      studentId,                     // opcional
      tz = 'America/Mexico_City'     // zona horaria
    } = req.query;

    // Filtro base
    const match = {};
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = new Date(from);
      if (to) match.date.$lte = new Date(to);
    }
    if (studentId) match.studentId = studentId;

    // Pipeline base
    const pipeline = [{ $match: match }];

    if (groupBy === 'student') {
      // Agrupar por alumno
      pipeline.push(
        { $group: { _id: '$studentId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }
      );
    } else {
      // Agrupar por día (default)
      pipeline.push(
        {
          $group: {
            _id: { $dateTrunc: { date: '$date', unit: 'day', timezone: tz } },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      );
    }

    const [rows, overall] = await Promise.all([
      Payment.aggregate(pipeline),
      Payment.aggregate([{ $match: match }, { $group: { _id: null, overallTotal: { $sum: '$amount' }, overallCount: { $sum: 1 } } }])
    ]);

    const data = (groupBy === 'student')
      ? rows.map(r => ({ studentId: r._id, total: r.total, count: r.count }))
      : rows.map(r => ({ date: r._id, total: r.total, count: r.count }));

    res.json({
      groupBy,
      range: { from: from || null, to: to || null, timezone: tz },
      overallTotal: overall[0]?.overallTotal || 0,
      overallCount: overall[0]?.overallCount || 0,
      rows: data
    });
  } catch (err) {
    console.error('[❌ Payments SUMMARY ERROR]', err);
    res.status(500).json({ error: 'Error al generar el resumen de pagos' });
  }
});

module.exports = router;
