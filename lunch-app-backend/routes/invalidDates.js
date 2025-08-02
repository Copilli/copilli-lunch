const express = require('express');
const router = express.Router();
const InvalidDate = require('../models/InvalidDate');
const { verifyToken, allowRoles } = require('../middleware/auth');
const dayjs = require('dayjs');

// Festivos oficiales y días personalizados
const holidayBridgesMX = [
  '2025-01-01',
  '2025-02-03',
  '2025-03-17',
  '2025-05-01',
  '2025-09-16',
  '2025-11-17',
  '2025-12-25',
];

const customInvalidDates = [
  '2025-04-30', // Día del niño (ejemplo)
];

// Generar fines de semana
function generateWeekendDates(year) {
  const weekends = [];
  const start = dayjs(`${year}-01-01`);
  const end = dayjs(`${year}-12-31`);

  for (let d = start; d.isBefore(end); d = d.add(1, 'day')) {
    if (d.day() === 0 || d.day() === 6) {
      weekends.push(d.format('YYYY-MM-DD'));
    }
  }

  return weekends;
}

// Crear automáticamente fechas inválidas del año si no existen
async function ensureInvalidDatesInDB(year) {
  const generated = [...generateWeekendDates(year), ...holidayBridgesMX, ...customInvalidDates];
  const existing = await InvalidDate.find({ date: { $in: generated } }).lean();
  const existingSet = new Set(existing.map(d => dayjs(d.date).format('YYYY-MM-DD')));

  const toInsert = generated
    .filter(date => !existingSet.has(date))
    .map(date => ({
      date: dayjs(date).toDate(),
      reason: 'auto-generado'
    }));

  if (toInsert.length > 0) {
    await InvalidDate.insertMany(toInsert);
    console.log(`[🗓️] Se agregaron ${toInsert.length} fechas inválidas automáticamente`);
  }
}

// GET: obtener todas las fechas inválidas
router.get('/', verifyToken, async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  await ensureInvalidDatesInDB(year);

  const dates = await InvalidDate.find({}).sort({ date: 1 });
  res.json(dates.map(d => dayjs(d.date).format('YYYY-MM-DD')));
});

// POST: agregar fecha inválida manualmente
router.post('/', verifyToken, allowRoles(['admin']), async (req, res) => {
  const { date, reason } = req.body;
  const exists = await InvalidDate.findOne({ date });
  if (exists) return res.status(400).json({ error: 'Ya existe' });

  const saved = await InvalidDate.create({ date, reason });
  res.json(saved);
});

module.exports = router;
