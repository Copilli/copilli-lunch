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
app.use('/api/payments', paymentRoutes);
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

// Iniciar servidor
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
