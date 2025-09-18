const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  person: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  // Add staff-specific fields here
  // Example: position, department, etc.
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);
