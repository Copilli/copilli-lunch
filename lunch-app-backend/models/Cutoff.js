// models/Cutoff.js
const mongoose = require('mongoose');

const cutoffSchema = new mongoose.Schema({
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  total: { type: Number, required: true },
  date: { type: Date, default: Date.now } 
});

module.exports = mongoose.model('Cutoff', cutoffSchema);