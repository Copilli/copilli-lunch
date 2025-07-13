const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const TokenMovement = require('../models/TokenMovement');

// Registrar un nuevo pago
router.post('/', async (req, res) => {
  try {
    const {
      studentId,
      amount,
      paymentType,
      tokensGranted,
      ticketNumber,
      period,
      issuedBy
    } = req.body;

    // Validar existencia del estudiante
    const student = await Student.findOne({ studentId });
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    // Crear y guardar el pago
    const payment = new Payment({
      studentId,
      amount,
      paymentType,
      tokensGranted,
      ticketNumber,
      period,
      issuedBy
    });

    await payment.save();

// Aplicar tokens al estudiante SOLO si es pago individual
if (paymentType === 'individual') {
  student.tokens += tokensGranted;
  await student.save();

  const movement = new TokenMovement({
    studentId,
    change: tokensGranted,
    reason: 'pago',
    note: `Pago con ticket ${ticketNumber}`,
    performedBy: issuedBy,
    userRole: 'oficina'
  });

  await movement.save();
}

    res.status(201).json({
      message: 'Pago registrado y tokens actualizados',
      tokens: student.tokens
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar pago' });
  }
});

// Obtener pagos (con filtros opcionales)
router.get('/', async (req, res) => {
  try {
    const { studentId, from, to } = req.query;
    const filter = {};

    if (studentId) filter.studentId = studentId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const payments = await Payment.find(filter).sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

module.exports = router;
