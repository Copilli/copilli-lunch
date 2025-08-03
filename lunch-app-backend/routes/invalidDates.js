const express = require('express');
const router = express.Router();
const InvalidDate = require('../models/InvalidDate');
const { verifyToken, allowRoles } = require('../middleware/auth');
const dayjs = require('dayjs');

// GET: obtener todas las fechas inválidas
router.get('/', verifyToken, async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  await ensureInvalidDatesInDB(year);

  const dates = await InvalidDate.find({}).sort({ date: 1 });
  res.json(dates.map(d => ({
    date: dayjs(d.date).format('YYYY-MM-DD'),
    reason: d.reason || 'Día sin clases'
    })));
});

module.exports = router;
