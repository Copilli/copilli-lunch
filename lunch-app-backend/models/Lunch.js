const mongoose = require('mongoose');

const lunchSchema = new mongoose.Schema({
  person: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  tokens: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['periodo-activo', 'con-fondos', 'sin-fondos', 'bloqueado'],
    default: 'sin-fondos'
  },
  hasSpecialPeriod: { type: Boolean, default: false },
  specialPeriod: {
    startDate: Date,
    endDate: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Lunch', lunchSchema);
