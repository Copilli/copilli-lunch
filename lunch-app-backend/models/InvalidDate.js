// models/InvalidDate.js
const mongoose = require('mongoose');

const invalidDateSchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  reason: { type: String, default: 'auto-generado' }
});

module.exports = mongoose.model('InvalidDate', invalidDateSchema);