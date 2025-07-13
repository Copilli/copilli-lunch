require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const { verifyToken, allowRoles } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch((err) => console.error('Error de conexión:', err));

// Rutas
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const paymentRoutes = require('./routes/payments');
const tokenMovementsRoutes = require('./routes/tokenMovements');

// Ruta pública: login
app.use('/api/login', authRoutes);

// Middleware de autenticación para el resto
app.use('/api', verifyToken);

// Rutas protegidas
app.use('/api/students', studentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/token-movements', tokenMovementsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
