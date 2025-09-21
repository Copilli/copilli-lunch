const mongoose = require('mongoose');

const PeriodLogSchema = new mongoose.Schema({
  entityId: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  note: { type: String, default: '' },
  reason: { type: String, default: 'nuevo periodo' },
  performedBy: { type: String, default: 'sistema' },
  userRole: { type: String, default: 'sistema' }
}, {
  timestamps: true  // esto añade automáticamente createdAt y updatedAt
});

module.exports = mongoose.model('PeriodLog', PeriodLogSchema);