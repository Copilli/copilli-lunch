const express = require('express');
const router = express.Router();
const Movement = require('../models/Movement');
const Lunch = require('../models/Lunch');
const { verifyToken, allowRoles } = require('../middleware/auth');
const { sendMovementEmail } = require('../utils/sendMovementEmail');
const Payment = require('../models/Payment');
const Person = require('../models/Person');

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

// 📌 Listar pagos con correo pendiente
router.get('/pending-mails', verifyToken, allowRoles('admin'), async (_req, res) => {
  try {
    const pending = await Payment.find({ sentEmail: false }).sort({ date: -1 });
    res.json({ count: pending.length, payments: pending });
  } catch (err) {
    console.error('[❌ Pending Mails ERROR]', err);
    res.status(500).json({ error: 'Error al obtener pagos con correos pendientes' });
  }
});

// 📌 Reenviar correos de movimientos tipo pago con sentEmail=false (opcionalmente filtrado)
router.post('/resend-mails', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const { from, to, entityId, limit, reason } = req.body || {};
    // Permite reenviar correos de cualquier razón, por defecto 'pago'
    const filter = {};
    if (reason) filter.reason = reason;
    else filter.reason = 'pago';

    if (entityId) filter.entityId = entityId;
    if (from || to) {
      filter.dateAffected = {};
      if (from) filter.dateAffected.$gte = new Date(from);
      if (to) filter.dateAffected.$lte = new Date(to);
    }

    let query = Movement.find(filter).sort({ dateAffected: 1 }); // más antiguos primero
    if (limit && Number.isInteger(limit) && limit > 0) {
      query = query.limit(limit);
    }
    const candidates = await query.lean();

    const results = {
      totalCandidates: candidates.length,
      attempted: 0,
      sent: 0,
      skippedNoEmail: 0,
      skippedAlreadySent: 0,
      errors: []
    };

    for (const mov of candidates) {
      // Solo para pagos: buscar Payment y revisar sentEmail
      let skip = false;
      let extra = {};
      if (mov.reason === 'pago') {
        const payment = await Payment.findOne({ movementId: mov._id });
        if (!payment) continue; // No hay payment relacionado
        if (payment.sentEmail) {
          results.skippedAlreadySent += 1;
          continue; // Ya enviado
        }
        extra.amount = payment.amount;
        extra.ticketNumber = payment.ticketNumber;
      }

      results.attempted += 1;
      const person = await Person.findOne({ entityId: mov.entityId }).lean();
      if (!person || !person.email) {
        results.skippedNoEmail += 1;
        continue;
      }
      try {
        await sendMovementEmail(mov, extra);
        // Si es pago, recargar Payment para actualizar sentEmail
        if (mov.reason === 'pago') {
          const paymentDoc = await Payment.findOne({ movementId: mov._id });
          if (paymentDoc && paymentDoc.sentEmail) results.sent += 1;
        }
        // Si no es pago, podrías agregar lógica para otros tipos aquí
      } catch (e) {
        results.errors.push({
          movementId: String(mov._id),
          entityId: mov.entityId,
          message: e?.message || 'Email send error'
        });
      }
    }

    res.json(results);
  } catch (err) {
    console.error('[❌ Resend Mails ERROR]', err);
    res.status(500).json({ error: 'Error al reenviar correos pendientes' });
  }
});

module.exports = router;
