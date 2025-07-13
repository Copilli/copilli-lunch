const express = require('express');
const router = express.Router();
const TokenMovement = require('../models/TokenMovement');
const Student = require('../models/Student');

// Crear un nuevo movimiento de token (sumar/restar y registrar)
router.post('/', async (req, res) => {
  try {
    const {
      studentId,
      change,
      reason,
      note,
      dateAffected,
      performedBy,
      userRole
    } = req.body;

    // Validar existencia del estudiante
    const student = await Student.findOne({ studentId });
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    // Aplicar el cambio
    student.tokens += change;
    await student.save();

    // Registrar el movimiento
    const movement = new TokenMovement({
      studentId,
      change,
      reason,
      note,
      dateAffected,
      performedBy,
      userRole
    });

    await movement.save();

    res.status(201).json({ message: 'Movimiento registrado', tokens: student.tokens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar movimiento' });
  }
});

// Obtener todos los movimientos (con filtros opcionales)
router.get('/', async (req, res) => {
  try {
    const { studentId, reason, performedBy, from, to } = req.query;
    const filter = {};

    if (studentId) filter.studentId = studentId;
    if (reason) filter.reason = reason;
    if (performedBy) filter.performedBy = performedBy;

    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const movements = await TokenMovement.find(filter).sort({ timestamp: -1 });
    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

module.exports = router;
