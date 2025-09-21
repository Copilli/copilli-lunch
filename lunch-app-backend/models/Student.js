// models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  person: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true, unique: true },
  // Agrega aquí campos específicos de estudiante si los necesitas
  // ejemplo: matricula, tutor, etc.
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
