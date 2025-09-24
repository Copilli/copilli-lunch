const mongoose = require('mongoose');

const movementSchema = new mongoose.Schema({
  entityId: { type: String, required: true }, // Always person.entityId (legacy, external to Lunch)
  change: { type: Number, required: true },
  reason: {
    type: String,
    enum: ['uso', 'uso-con-deuda', 'pago', 'justificado', 'ajuste manual', 'periodo-activado', 'periodo-expirado', 'periodo-removido', 'uso-periodo'],
    required: true
  },
  note: String,
  dateAffected: Date, // Día en que el movimiento aplica (ej. falta justificada)
  timestamp: { type: Date, default: Date.now },
  performedBy: String, // usuario que lo hizo
  userRole: { type: String, enum: ['admin', 'oficina', 'cocina'] }
});

// Post-save hook para enviar email tras guardar un movimiento
// Protecciones:
// - No lanza errores, solo loguea
// - Solo envía si la persona existe y tiene email
// - No modifica el documento ni guarda de nuevo
// - Respeta variable de entorno para desactivar en test/dev
movementSchema.post('save', async function(doc) {
  try {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_MOVEMENT_EMAIL === '1') return;
    const { sendMovementEmail } = require('../utils/sendMovementEmail');
    const Person = require('../models/Person');
    let extra = {};
    // Si el movimiento es pago, agrega info extra
    if (doc.reason === 'pago') {
      const Payment = require('../models/Payment');
      const payment = await Payment.findOne({ movementId: doc._id });
      if (payment) {
        extra.amount = payment.amount;
        extra.ticketNumber = payment.ticketNumber;
      }
    }
    // Para cualquier tipo de movimiento, envía el correo si la persona tiene email válido
    const person = await Person.findOne({ entityId: doc.entityId }).lean();
    if (person && person.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(person.email)) {
      await sendMovementEmail(doc, extra);
    }
  } catch (err) {
    // Solo loguea, nunca lanza
    console.error('[Movement post-save email error]', err);
  }
});

module.exports = mongoose.model('Movement', movementSchema);
