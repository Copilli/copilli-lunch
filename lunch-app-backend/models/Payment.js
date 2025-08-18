const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  tokenMovementId: { type: mongoose.Schema.Types.ObjectId, ref: 'TokenMovement', required: true },
  ticketNumber: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  sentEmail: { type: Boolean, default: false }
}, { timestamps: true });

/** Genera ticket secuencial TCK-00001, TCK-00002, ... */
paymentSchema.statics.generateTicketNumber = async function () {
  const last = await this.findOne().sort({ createdAt: -1 }).select('ticketNumber').lean();
  if (!last || !last.ticketNumber) return 'TCK-00001';
  const lastNum = parseInt(String(last.ticketNumber).split('-')[1] || '0', 10);
  const nextNum = String((isNaN(lastNum) ? 0 : lastNum) + 1).padStart(5, '0');
  return `TCK-${nextNum}`;
};

/** 🔒 Máximo 1 Payment por TokenMovement (evita duplicados por doble click). */
paymentSchema.index(
  { tokenMovementId: 1 },
  {
    unique: true,
    partialFilterExpression: { tokenMovementId: { $exists: true } } // evita choque si hay docs viejos sin ese campo
  }
);

/** ⚡ Consultas más rápidas en reportes/dashboard */
paymentSchema.index({ studentId: 1, date: -1 });
paymentSchema.index({ sentEmail: 1, date: -1 });

module.exports = mongoose.model('Payment', paymentSchema);