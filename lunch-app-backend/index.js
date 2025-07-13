require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const dayjs = require('dayjs');
const Student = require('./models/Student');

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
const paymentRoutes = require('./routes/payments');
const tokenMovementsRoutes = require('./routes/tokenMovements');
const PeriodLog = require('./models/PeriodLog');
const TokenMovement = require('./models/TokenMovement');

if (
  !authRoutes ||
  !studentRoutes ||
  !paymentRoutes ||
  !tokenMovementsRoutes
) {
  console.error('❌ Uno de los archivos de rutas no se pudo cargar. Verifica los nombres y exports.');
  process.exit(1);
}

// Ruta pública para login
app.use('/api/auth', authRoutes);

// Rutas protegidas
app.use('/api/students', studentRoutes);
app.use('/api/token-movements', tokenMovementsRoutes);

// Ruta base
app.get('/', (req, res) => {
  res.send('API de desayunos funcionando ✅');
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Cron job diario para desactivar periodos vencidos
cron.schedule('5 0 * * *', async () => {
  console.log('[CRON] Verificando periodos especiales vencidos...');
  try {
    const today = dayjs().startOf('day').toDate();
    const result = await Student.updateMany(
      {
        hasSpecialPeriod: true,
        'specialPeriod.endDate': { $lt: today }
      },
      {
        $set: { hasSpecialPeriod: false }
      }
    );
    console.log(`[CRON] Periodos desactivados: ${result.modifiedCount}`);
  } catch (err) {
    console.error('[CRON] Error al desactivar periodos vencidos:', err.message);
  }
});

// Cron job diario para activar nuevos periodos registrados en PeriodLog
cron.schedule('1 0 * * *', async () => {
  console.log('[CRON] Activando nuevos periodos desde PeriodLog...');
  try {
    const today = dayjs().startOf('day').toDate();

    const logs = await PeriodLog.find({ startDate: { $eq: today } });

    let updatedCount = 0;
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

      // Registrar en TokenMovement
      const movement = new TokenMovement({
        studentId: student.studentId,
        change: 0,
        reason: 'periodo-activado',
        note: 'Periodo activado automáticamente desde PeriodLog',
        performedBy: 'sistema',
        userRole: 'sistema'
      });
      await movement.save();

      updatedCount++;
    }

    console.log(`[CRON] Periodos activados para ${updatedCount} estudiante(s).`);
  } catch (err) {
    console.error('[CRON] Error al activar nuevos periodos:', err.message);
  }
});

// Iniciar servidor
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
