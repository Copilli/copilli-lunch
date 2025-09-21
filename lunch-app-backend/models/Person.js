const mongoose = require('mongoose');

const personSchema = new mongoose.Schema({
  entityId: { type: String, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  type: { type: String, enum: ['student', 'staff'], required: true },
  photoUrl: { type: String, default: '' },
  group: {
    level: { type: String, enum: ['preescolar', 'primaria', 'secundaria', 'personal'], required: true },
    name:  { type: String, required: true }
  }
}, { timestamps: true });

/** Genera un entityId secuencial: STD-00001 para estudiantes, STF-00001 para staff */
personSchema.statics.generatePersonId = async function (type) {
  const prefix = type === 'staff' ? 'STF' : 'STD';
  const last = await this.findOne({ entityId: new RegExp(`^${prefix}-\\d{5}$`) })
    .sort({ createdAt: -1 })
    .select('entityId')
    .lean();
  if (!last || !last.entityId) return `${prefix}-00001`;
  const lastNum = parseInt(String(last.entityId).split('-')[1] || '0', 10);
  const nextNum = String((isNaN(lastNum) ? 0 : lastNum) + 1).padStart(5, '0');
  return `${prefix}-${nextNum}`;
};

personSchema.pre('save', async function (next) {
  if (!this.entityId) {
    this.entityId = await this.constructor.generatePersonId(this.type);
  }
  next();
});

module.exports = mongoose.model('Person', personSchema);
