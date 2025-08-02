const mongoose = require('mongoose');
const dayjs = require('dayjs');
require('dotenv').config();
const InvalidDate = require('../models/InvalidDate');

// === CONFIGURACIÓN ===
const year = 2025;

const holidayBridgesMX = [
  '2025-01-01', // Año nuevo
  '2025-02-03', // Constitución
  '2025-03-17', // Benito Juárez
  '2025-05-01', // Día del trabajo
  '2025-09-16', // Independencia
  '2025-11-17', // Revolución
  '2025-12-25', // Navidad
];

const customInvalidDates = [
  '2025-12-24', // Noche Buena, ejemplo personalizado
];

const customInvalidPeriods = [
  {
    start: '2025-07-15',
    end: '2025-08-15',
    reason: 'Vacaciones de verano'
  },
  {
    start: '2025-12-16',
    end: '2025-12-31',
    reason: 'Cierre de año'
  }
];

// === UTILIDADES ===
function generateWeekendDates(year) {
  const weekends = [];
  const start = dayjs(`${year}-01-01`);
  const end = dayjs(`${year}-12-31`);

  for (let d = start; d.isBefore(end) || d.isSame(end); d = d.add(1, 'day')) {
    if (d.day() === 0 || d.day() === 6) {
      weekends.push(d.format('YYYY-MM-DD'));
    }
  }

  return weekends;
}

function expandPeriods(periods) {
  const expanded = [];
  for (const period of periods) {
    const start = dayjs(period.start);
    const end = dayjs(period.end);
    for (let d = start; d.isBefore(end) || d.isSame(end); d = d.add(1, 'day')) {
      expanded.push({
        date: d.format('YYYY-MM-DD'),
        reason: period.reason || 'periodo personalizado'
      });
    }
  }
  return expanded;
}

// === EJECUCIÓN ===
async function run() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ No se encontró MONGODB_URI en .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✅ Conectado a MongoDB');

  // 1. Consolidar fechas
  const weekendDates = generateWeekendDates(year).map(d => ({ date: d, reason: 'fin de semana' }));
  const bridgeDates = holidayBridgesMX.map(d => ({ date: d, reason: 'puente' }));
  const singleDates = customInvalidDates.map(d => ({ date: d, reason: 'personalizado' }));
  const expandedPeriods = expandPeriods(customInvalidPeriods);

  const allDates = [...weekendDates, ...bridgeDates, ...singleDates, ...expandedPeriods];

  // 2. Filtrar duplicados ya existentes
  const existing = await InvalidDate.find({
    date: { $in: allDates.map(d => new Date(d.date)) }
  });

  const existingSet = new Set(existing.map(e => dayjs(e.date).format('YYYY-MM-DD')));

  const toInsert = allDates
    .filter(d => !existingSet.has(d.date))
    .map(d => ({
      date: new Date(d.date),
      reason: d.reason
    }));

  if (toInsert.length > 0) {
    await InvalidDate.insertMany(toInsert);
    console.log(`🗓️ Agregadas ${toInsert.length} fechas inválidas`);
  } else {
    console.log('ℹ️ No se agregaron nuevas fechas (ya estaban registradas)');
  }

  await mongoose.disconnect();
  console.log('🔌 Desconectado de MongoDB');
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
