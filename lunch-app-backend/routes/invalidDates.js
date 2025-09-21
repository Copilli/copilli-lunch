const express = require('express');
const router = express.Router();
const InvalidDate = require('../models/InvalidDate');
const { verifyToken, allowRoles } = require('../middleware/auth');
const dayjs = require('dayjs');

// GET: obtener todas las fechas inválidas
router.get('/', verifyToken, async (req, res) => {
  const dates = await InvalidDate.find({}).sort({ date: 1 });
  res.json(dates.map(d => ({
    date: d.date instanceof Date ? d.date.toISOString().slice(0, 10) : d.date,
    reason: d.reason || 'Día sin clases'
  })));
});

module.exports = router;
