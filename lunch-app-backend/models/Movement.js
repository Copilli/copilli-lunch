const mongoose = require('mongoose');

const movementSchema = new mongoose.Schema({
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Can reference Lunch or other entities
  change: { type: Number, required: true },
  reason: {
    type: String,
    enum: ['uso', 'uso-con-deuda', 'pago', 'justificado', 'ajuste manual', 'periodo-activado', 'periodo-expirado', 'periodo-removido'],
    required: true
  },
  note: String,
  dateAffected: Date, // Día en que el movimiento aplica (ej. falta justificada)
  timestamp: { type: Date, default: Date.now },
  performedBy: String, // usuario que lo hizo
  userRole: { type: String, enum: ['admin', 'oficina', 'cocina'] }
});

module.exports = mongoose.model('Movement', movementSchema);
