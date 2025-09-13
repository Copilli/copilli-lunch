const mongoose = require('mongoose');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);
require('dotenv').config();
const InvalidDate = require('../models/InvalidDate');

// === CONFIGURACIÓN ===
const year = 2025;

const holidayBridgesMX = [
  '2026-01-01', // Año nuevo
  '2026-02-02', // Constitución
  '2026-03-16', // Benito Juárez
  '2026-05-01', // Día del trabajo
  '2026-05-05', // 
  '2026-05-15', // 
  '2025-09-16', // Independencia
  '2025-11-17', // Revolución
  '2025-12-25', // Navidad
];

const customInvalidDates = [
'2025-12-24', // Noche Buena, ejemplo personalizado
'2025-09-26', // CTE
'2025-10-31', // CTE
'2026-01-30', // CTE
'2026-02-27', // CTE
'2026-03-27', // CTE
'2026-05-29', // CTE
'2026-06-26', // CTE
];

const customInvalidPeriods = [
  {
    start: '2025-12-22',
    end: '2026-01-11',
    reason: 'Cierre de año'
  },
  {
    start: '2026-03-27',
    end: '2026-04-10',
    reason: 'Vacaciones de verano'
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

  try {
    await mongoose.connect(uri);
    console.log('✅ Conectado a MongoDB');

    const weekendDates = generateWeekendDates(year).map(d => ({ date: d, reason: 'fin de semana' }));
    const bridgeDates = holidayBridgesMX.map(d => ({ date: d, reason: 'puente' }));
    const singleDates = customInvalidDates.map(d => ({ date: d, reason: 'personalizado' }));
    const expandedPeriods = expandPeriods(customInvalidPeriods);

    const allDates = [...weekendDates, ...bridgeDates, ...singleDates, ...expandedPeriods];

    const existing = await InvalidDate.distinct('date');
    const existingSet = new Set(existing.map(e => dayjs.utc(e).format('YYYY-MM-DD')));

    // Agrupar por fecha (solo una razón por fecha)
    const grouped = new Map();

    for (const d of allDates) {
      const key = dayjs.utc(d.date).format('YYYY-MM-DD');
      if (!grouped.has(key)) {
        grouped.set(key, { date: key, reason: d.reason });
      }
    }

    // Preparar lote limpio y sin duplicados
    const toInsert = Array.from(grouped.values())
      .filter(d => !existingSet.has(d.date))
      .map(d => ({
        date: dayjs.utc(d.date).startOf('day').toDate(),
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
  } catch (err) {
    console.error('❌ Error al ejecutar el script:', err.message);
    process.exit(1);
  }
}

run();
