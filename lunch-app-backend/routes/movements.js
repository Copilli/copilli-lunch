const express = require('express');
const router = express.Router();
const Movement = require('../models/Movement');
const Lunch = require('../models/Lunch');

// Crear un nuevo movimiento general (solo registrar, no modificar tokens)
router.post('/', async (req, res) => {
  try {
    const {
  entityId,
      change,
      reason,
      note,
      dateAffected,
      performedBy,
      userRole
    } = req.body;

    // Validar existencia del lunch
  // Optionally validate entityId exists for known types (e.g., Lunch)
  // For now, just check it's a valid ObjectId
  if (!entityId) return res.status(400).json({ error: 'entityId is required' });

    // Registrar el movimiento (no modificar tokens)
    const movement = new Movement({
      entityId,
      change,
      reason,
      note,
      dateAffected,
      performedBy,
      userRole
    });

    await movement.save();

    res.status(201).json({ message: 'Movimiento registrado', movement });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar movimiento' });
  }
});

// Obtener todos los movimientos (con filtros opcionales)
router.get('/', async (req, res) => {
  try {
    const { reason, performedBy, from, to } = req.query;
    const filter = {};
  if (req.query.entityId) filter.entityId = req.query.entityId;
    if (reason) filter.reason = reason;
    if (performedBy) filter.performedBy = performedBy;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }
    const movements = await Movement.find(filter).sort({ timestamp: -1 });
    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

module.exports = router;
