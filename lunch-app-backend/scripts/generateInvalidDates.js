// scripts/generateInvalidDates.js
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const InvalidDate = require('../models/InvalidDate');

// Configura tu URI de conexión aquí
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost/copilli-lunch';

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
  '2025-04-30',
];

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

async function run() {
  const year = 2025;
  await mongoose.connect(MONGO_URI);
  console.log('[✅] Conectado a MongoDB');

  const generatedDates = [...generateWeekendDates(year), ...holidayBridgesMX, ...customInvalidDates];
  const existing = await InvalidDate.find({ date: { $in: generatedDates.map(d => new Date(d)) } }).lean();
  const existingSet = new Set(existing.map(d => dayjs(d.date).format('YYYY-MM-DD')));

  const toInsert = generatedDates
    .filter(date => !existingSet.has(date))
    .map(date => ({
      date: new Date(date),
      reason: 'auto-generado'
    }));

  if (toInsert.length > 0) {
    await InvalidDate.insertMany(toInsert);
    console.log(`[🗓️] Agregadas ${toInsert.length} fechas inválidas`);
  } else {
    console.log('No se agregaron nuevas fechas (ya estaban registradas)');
  }

  await mongoose.disconnect();
  console.log('[🔌] Desconectado de MongoDB');
}

run().catch(err => {
  console.error('Error al generar fechas inválidas:', err);
  process.exit(1);
});
