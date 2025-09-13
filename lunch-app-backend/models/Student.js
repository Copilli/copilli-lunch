// models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  group: {
    level: { type: String, enum: ['preescolar', 'primaria', 'secundaria', 'personal'], required: true },
    name:  { type: String, required: true }
  },
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
  },
  notes: String,
  photoUrl: { type: String, default: '' }
}, { timestamps: true });

/** Genera un studentId secuencial: STD-00001, STD-00002, ... */
studentSchema.statics.generateStudentId = async function () {
  const prefix = 'STD';
  // Busca el último con patrón STD-00000 (por createdAt)
  const last = await this.findOne({ studentId: new RegExp(`^${prefix}-\\d{5}$`) })
    .sort({ createdAt: -1 })
    .select('studentId')
    .lean();

  if (!last || !last.studentId) return `${prefix}-00001`;

  const lastNum = parseInt(String(last.studentId).split('-')[1] || '0', 10);
  const nextNum = String((isNaN(lastNum) ? 0 : lastNum) + 1).padStart(5, '0');
  return `${prefix}-${nextNum}`;
};

/** Si no trae studentId, lo autogenera antes de guardar */
studentSchema.pre('save', async function (next) {
  if (!this.studentId) {
    this.studentId = await this.constructor.generateStudentId();
  }
  next();
});

module.exports = mongoose.model('Student', studentSchema);
