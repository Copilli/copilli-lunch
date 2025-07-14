const mongoose = require('mongoose');

const tokenMovementSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  change: { type: Number, required: true },
  reason: {
    type: String,
    enum: ['uso', 'uso-con-deuda', 'pago', 'justificado', 'ajuste manual'],
    required: true
  },
  note: String,
  dateAffected: Date, // Día en que el movimiento aplica (ej. falta justificada)
  timestamp: { type: Date, default: Date.now },
  performedBy: String, // usuario que lo hizo
  userRole: { type: String, enum: ['admin', 'oficina', 'cocina'] }
});

module.exports = mongoose.model('TokenMovement', tokenMovementSchema);
