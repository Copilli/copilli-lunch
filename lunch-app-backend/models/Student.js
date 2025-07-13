// models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: String,
  studentId: String,
  group: {
    level: { type: String, enum: ['preescolar', 'primaria', 'secundaria'], required: true },
    name: String
  },
  tokens: { type: Number, default: 0 },
  hasSpecialPeriod: { type: Boolean, default: false },
  specialPeriod: {
    startDate: Date,
    endDate: Date
  },
  status: { type: String, default: 'activo' },
  notes: String,
  photoUrl: { type: String, default: '' }
});

module.exports = mongoose.model('Student', studentSchema);
