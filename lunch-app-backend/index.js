require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const dayjs = require('dayjs');
const Student = require('./models/Student');
const PeriodLog = require('./models/PeriodLog');
const TokenMovement = require('./models/TokenMovement');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors({
  origin: 'https://copilli.github.io',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

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
const studentRoutes = require('./routes/students');
const tokenMovementsRoutes = require('./routes/tokenMovements');
const invalidDatesRoutes = require('./routes/invalidDates');

if (!authRoutes || !studentRoutes || !tokenMovementsRoutes || !invalidDatesRoutes) {
  console.error('❌ Uno de los archivos de rutas no se pudo cargar. Verifica los nombres y exports.');
  process.exit(1);
}

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/token-movements', tokenMovementsRoutes);
app.use('/api/invalid-dates', invalidDatesRoutes);

app.get('/', (req, res) => {
  res.send('API de desayunos funcionando ✅');
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// 🕒 CRON: Ejecutar manualmente para activar/desactivar periodos
app.get('/api/cron/wake', async (req, res) => {
  try {
    const today = dayjs().startOf('day').toDate();

    // 🔴 Desactivar periodos expirados
    const expiredStudents = await Student.find({
      hasSpecialPeriod: true,
      'specialPeriod.endDate': { $lt: today }
    });

    let desactivados = 0;
    for (const student of expiredStudents) {
      student.hasSpecialPeriod = false;
      student.specialPeriod = { startDate: null, endDate: null };
      student.status = student.tokens > 0 ? 'con-fondos' : 'sin-fondos';
      await student.save();

      await TokenMovement.create({
        studentId: student.studentId,
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
      const student = await Student.findOne({ studentId: log.studentId });
      if (!student) continue;

      student.specialPeriod = {
        startDate: log.startDate,
        endDate: log.endDate
      };
      student.hasSpecialPeriod = true;
      student.status = 'periodo-activo';
      await student.save();

      await TokenMovement.create({
        studentId: student.studentId,
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


// 🕒 CRON: Desactivar periodos vencidos + registrar movimiento
cron.schedule('5 0 * * *', async () => {
  console.log('[CRON] Verificando periodos especiales vencidos...');
  try {
    const today = dayjs().startOf('day').toDate();

    const expiredStudents = await Student.find({
      hasSpecialPeriod: true,
      'specialPeriod.endDate': { $lt: today }
    });

    let desactivados = 0;
    for (const student of expiredStudents) {
      student.hasSpecialPeriod = false;
      student.specialPeriod = { startDate: null, endDate: null };
      student.status = student.tokens > 0 ? 'con-fondos' : 'sin-fondos';
      await student.save();

      const movement = new TokenMovement({
        studentId: student.studentId,
        change: 0,
        reason: 'periodo-expirado',
        note: 'Periodo especial expirado automáticamente por cron',
        performedBy: 'sistema',
        userRole: 'sistema'
      });
      await movement.save();

      desactivados++;
    }

    console.log(`[CRON] Periodos desactivados: ${desactivados}`);
  } catch (err) {
    console.error('[CRON] Error al desactivar periodos vencidos:', err.message);
  }
});

// 🕒 CRON: Activar nuevos periodos desde PeriodLog
cron.schedule('5 0 * * *', async () => {
  console.log('[CRON] Activando nuevos periodos desde PeriodLog...');
  try {
    const today = dayjs().startOf('day').toDate();
    const logs = await PeriodLog.find({ startDate: { $eq: today } });

    let activados = 0;
    for (const log of logs) {
      const student = await Student.findOne({ studentId: log.studentId });
      if (!student) continue;

      student.specialPeriod = {
        startDate: log.startDate,
        endDate: log.endDate
      };
      student.hasSpecialPeriod = true;
      student.status = 'periodo-activo';
      await student.save();

      const movement = new TokenMovement({
        studentId: student.studentId,
        change: 0,
        reason: 'periodo-activado',
        note: 'Periodo activado automáticamente desde PeriodLog',
        performedBy: 'sistema',
        userRole: 'sistema'
      });
      await movement.save();

      activados++;
    }

    console.log(`[CRON] Periodos activados para ${activados} estudiante(s).`);
  } catch (err) {
    console.error('[CRON] Error al activar nuevos periodos:', err.message);
  }
});

// Iniciar servidor
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
