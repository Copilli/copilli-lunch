const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Person = require('../models/Person');
const Lunch = require('../models/Lunch');
const { verifyToken, allowRoles } = require('../middleware/auth');
const { sendPaymentEmail } = require('../utils/sendPaymentEmail');

// 📌 Obtener pagos (filtros opcionales)
router.get('/', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const { entityId, from, to } = req.query;
    const filter = {};
    if (entityId) filter.entityId = entityId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    const payments = await Payment.find(filter)
      .populate('movementId')
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
    const { from, to, entityId, limit } = req.body || {};
    const filter = { sentEmail: false };

    if (entityId) filter.entityId = entityId;
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

      // Buscar persona por entityId para tener email
      const person = await Person.findOne({ entityId: pay.entityId }).lean();
      if (!person || !person.email) {
        results.skippedNoEmail += 1;
        continue;
      }

      try {
        // Recargar Payment como doc para actualizar sentEmail
        const paymentDoc = await Payment.findById(pay._id);
        await sendPaymentEmail(person, paymentDoc, 'MXN');
        if (paymentDoc.sentEmail) results.sent += 1;
      } catch (e) {
        results.errors.push({
          paymentId: String(pay._id),
          entityId: pay.entityId,
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
      groupBy = 'day',               // 'day' | 'entity'
      from,                          // 'YYYY-MM-DD'
      to,                            // 'YYYY-MM-DD'
      entityId,                      // opcional
      tz = 'America/Mexico_City'     // zona horaria
    } = req.query;

    // Filtro base
    const match = {};
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = new Date(from);
      if (to) match.date.$lte = new Date(to);
    }
    if (entityId) match.entityId = entityId;

    // Pipeline base
    const pipeline = [{ $match: match }];

    if (groupBy === 'entity') {
      // Agrupar por entidad
      pipeline.push(
        { $group: { _id: '$entityId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
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

    const data = (groupBy === 'entity')
      ? rows.map(r => ({ entityId: r._id, total: r.total, count: r.count }))
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
