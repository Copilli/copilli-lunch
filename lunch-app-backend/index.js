require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const dayjs = require('dayjs');
const Person = require('./models/Person');
const Lunch = require('./models/Lunch');
const Movement = require('./models/Movement');
const PeriodLog = require('./models/PeriodLog');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
const allowedOrigins = [
  'https://copilli.github.io',
  'http://localhost:5173'
];
app.use(cors({
  origin: function(origin, callback) {
    // Permitir solicitudes sin origen (como Postman) o desde los orígenes permitidos
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Conexión a MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => {
    console.error('❌ Error de conexión a MongoDB:', err.message);
    process.exit(1);
  });

// Rutas
const authRoutes = require('./routes/auth');
const personsRoutes = require('./routes/persons');
const lunchRoutes = require('./routes/lunch');
const movementsRoutes = require('./routes/movements');
const paymentsRoutes = require('./routes/payments');
const invalidDatesRoutes = require('./routes/invalidDates');
const cutoffRoutes = require('./routes/cutoffs');

if (!authRoutes || !personsRoutes || !lunchRoutes || !movementsRoutes || !paymentsRoutes || !invalidDatesRoutes || !cutoffRoutes) {
  console.error('❌ Uno de los archivos de rutas no se pudo cargar.');
  process.exit(1);
}

app.use('/api/auth', authRoutes);
app.use('/api/persons', personsRoutes);
app.use('/api/lunch', lunchRoutes);
app.use('/api/movements', movementsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/invalid-dates', invalidDatesRoutes);
app.use('/api/cutoffs', cutoffRoutes);

// 🕒 CRON: Ejecutar manualmente para activar/desactivar periodos
app.get('/api/cron/wake', async (req, res) => {
  try {
    const today = dayjs().startOf('day').toDate();

    // 🔴 Desactivar periodos expirados
    const expiredLunches = await Lunch.find({
      hasSpecialPeriod: true,
      'specialPeriod.endDate': { $lt: today }
    });

    let desactivados = 0;
    for (const lunch of expiredLunches) {
    lunch.hasSpecialPeriod = false;
    lunch.specialPeriod = { startDate: null, endDate: null };
    lunch.status = lunch.tokens > 0 ? 'con-fondos' : 'sin-fondos';
    await lunch.save();

    // Find the person for this lunch to get entityId
    const person = await Person.findById(lunch.person).lean();
    await Movement.create({
      entityId: person && person.entityId ? person.entityId : '',
      change: 0,
      reason: 'periodo-expirado',
      note: 'Periodo especial expirado automáticamente por cron',
      performedBy: 'sistema',
      userRole: 'sistema'
    });

      desactivados++;
    }

    // 🟢 Activar nuevos periodos desde PeriodLog
    const logs = await PeriodLog.find({ startDate: { $eq: today } });

    let activados = 0;
    for (const log of logs) {
    const lunch = await Lunch.findById(log.lunchId);
    if (!lunch) continue;

    lunch.specialPeriod = {
      startDate: log.startDate,
      endDate: log.endDate
    };
    lunch.hasSpecialPeriod = true;
    lunch.status = 'periodo-activo';
    await lunch.save();

    // Find the person for this lunch to get entityId
    const person = await Person.findById(lunch.person).lean();
    await Movement.create({
      entityId: person && person.entityId ? person.entityId : '',
      change: 0,
      reason: 'periodo-activado',
      note: 'Periodo activado automáticamente desde PeriodLog',
      performedBy: 'sistema',
      userRole: 'sistema'
    });

      activados++;
    }

    res.json({
      message: 'Cron manual ejecutado',
      desactivados,
      activados
    });
  } catch (err) {
    console.error('[CRON /api/cron/wake ERROR]', err);
    res.status(500).json({ error: 'Error al ejecutar el cron manualmente' });
  }
});

app.get('/', (req, res) => {
  res.send('API de desayunos funcionando ✅');
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// 🕒 CRON: Desactivar periodos vencidos + registrar movimiento
cron.schedule('5 0 * * 1-5', async () => {
  console.log('[CRON] Verificando periodos especiales vencidos...');
  try {
    const today = dayjs().startOf('day').toDate();

    const expiredLunches = await Lunch.find({
      hasSpecialPeriod: true,
      'specialPeriod.endDate': { $lt: today }
    });

    let desactivados = 0;
    for (const lunch of expiredLunches) {
      lunch.hasSpecialPeriod = false;
      lunch.specialPeriod = { startDate: null, endDate: null };
      lunch.status = lunch.tokens > 0 ? 'con-fondos' : 'sin-fondos';
      await lunch.save();

      // Find the person for this lunch to get entityId
      const person = await Person.findById(lunch.person).lean();
      await Movement.create({
        entityId: person && person.entityId ? person.entityId : '',
        change: 0,
        reason: 'periodo-expirado',
        note: 'Periodo especial expirado automáticamente por cron',
        performedBy: 'sistema',
        userRole: 'sistema'
      });

      desactivados++;
    }

    console.log(`[CRON] Periodos desactivados: ${desactivados}`);
  } catch (err) {
    console.error('[CRON] Error al desactivar periodos vencidos:', err.message);
  }
});

// 🕒 CRON: Activar nuevos periodos desde PeriodLog
cron.schedule('5 0 * * 1-5', async () => {
  console.log('[CRON] Activando nuevos periodos desde PeriodLog...');
  try {
    const today = dayjs().startOf('day').toDate();
    const logs = await PeriodLog.find({ startDate: { $eq: today } });

    let activados = 0;
    for (const log of logs) {
    const lunch = await Lunch.findById(log.lunchId);
    if (!lunch) continue;

    lunch.specialPeriod = {
      startDate: log.startDate,
      endDate: log.endDate
    };
    lunch.hasSpecialPeriod = true;
    lunch.status = 'periodo-activo';
    await lunch.save();

    // Find the person for this lunch to get entityId
    const person = await Person.findById(lunch.person).lean();
    await Movement.create({
      entityId: person && person.entityId ? person.entityId : '',
      change: 0,
      reason: 'periodo-activado',
      note: 'Periodo activado automáticamente desde PeriodLog',
      performedBy: 'sistema',
      userRole: 'sistema'
    });

      activados++;
    }

    console.log(`[CRON] Periodos activados para ${activados} lunch(es).`);
  } catch (err) {
    console.error('[CRON] Error al activar nuevos periodos:', err.message);
  }
});

// Iniciar servidor
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
