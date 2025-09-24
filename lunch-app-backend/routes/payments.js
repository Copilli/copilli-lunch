const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Person = require('../models/Person');
const Lunch = require('../models/Lunch');
const { verifyToken, allowRoles } = require('../middleware/auth');

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
