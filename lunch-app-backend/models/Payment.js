const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  date: { type: Date, default: Date.now },
  amount: Number,
  paymentType: { type: String, enum: ['periodo', 'individual'], required: true },
  tokensGranted: Number,
  ticketNumber: String,
  period: {
    startDate: Date,
    endDate: Date
  },
  issuedBy: String
});

module.exports = mongoose.model('Payment', paymentSchema);
