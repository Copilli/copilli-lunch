// routes/cutoffs.js
const express = require('express');
const router = express.Router();
const Cutoff = require('../models/Cutoff');
const Payment = require('../models/Payment');
const { verifyToken, allowRoles } = require('../middleware/auth');

// 📌 Ver pagos pendientes desde el último corte
router.get('/pending', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const lastCutoff = await Cutoff.findOne().sort({ to: -1 });
    const from = lastCutoff ? lastCutoff.to : new Date(0); // desde inicio si no hay corte
    const to = new Date();

    const total = await Payment.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    res.json({
      from,
      to,
      total: total[0]?.total || 0
    });
  } catch (err) {
    console.error('[❌ Cutoff PENDING ERROR]', err);
    res.status(500).json({ error: 'Error al calcular pagos pendientes' });
  }
});

// 📌 Realizar un corte de caja
router.post('/', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const lastCutoff = await Cutoff.findOne().sort({ to: -1 });
    const from = lastCutoff ? lastCutoff.to : new Date(0);
    const to = new Date();

    const total = await Payment.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const cutoff = new Cutoff({
      from,
      to,
      total: total[0]?.total || 0
    });
    await cutoff.save();

    res.json(cutoff);
  } catch (err) {
    console.error('[❌ Cutoff CREATE ERROR]', err);
    res.status(500).json({ error: 'Error al crear el corte de caja' });
  }
});

// 📌 Historial de cortes
router.get('/', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const history = await Cutoff.find().sort({ date: -1 });
    res.json(history);
  } catch (err) {
    console.error('[❌ Cutoff HISTORY ERROR]', err);
    res.status(500).json({ error: 'Error al obtener historial de cortes' });
  }
});

module.exports = router;
