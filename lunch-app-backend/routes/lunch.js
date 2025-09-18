const express = require('express');
const router = express.Router();
const Lunch = require('../models/Lunch');
const Student = require('../models/Student');
// const TokenMovement = require('../models/TokenMovement');
const PeriodLog = require('../models/PeriodLog');
const InvalidDate = require('../models/InvalidDate');
const Payment = require('../models/Payment');
const Movement = require('../models/Movement');
const dayjs = require('dayjs');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

// Helper: Get prices by level/group
function getPricesForLevel(level, groupName) {
  level = (level || '').toLowerCase();
  groupName = (groupName || '').toUpperCase();
  if (level === 'preescolar') return { priceToken: 44, pricePeriod: 40 };
  if (level === 'secundaria') return { priceToken: 62, pricePeriod: 52 };
  if (level === 'primaria') {
    if (/^[1-3]/.test(groupName)) return { priceToken: 50, pricePeriod: 44 };
    if (/^[4-6]/.test(groupName)) return { priceToken: 57, pricePeriod: 47 };
    return { priceToken: 57, pricePeriod: 47 };
  }
  return { priceToken: 62, pricePeriod: 52 };
}

// Helper: Count valid days
async function getInvalidSet() {
  const docs = await InvalidDate.find({});
  return new Set(docs.map(doc => dayjs(doc.date).format('YYYY-MM-DD')));
}
function countValidDays(start, end, invalidSet) {
  let valid = 0;
  let c = dayjs(start).startOf('day');
  const e = dayjs(end).startOf('day');
  while (c.isSameOrBefore(e, 'day')) {
    if (!invalidSet.has(c.format('YYYY-MM-DD'))) valid++;
    c = c.add(1, 'day');
  }
  return valid;
}

const { verifyToken, allowRoles } = require('../middleware/auth');
const { sendPaymentEmail } = require('../utils/sendPaymentEmail');
const { sendUseEmail } = require('../utils/sendUseEmail');

// POST /api/lunch/:id/add-tokens - add tokens and register movement
router.post('/:id/add-tokens', async (req, res) => {
  try {
    const { amount, reason = 'ajuste manual', note = '', performedBy, userRole } = req.body;
    if (typeof amount !== 'number') {
      return res.status(400).json({ error: 'El campo amount debe ser un número' });
    }
    const lunch = await Lunch.findById(req.params.id);
    if (!lunch) return res.status(404).json({ error: 'Lunch info not found' });
    lunch.tokens += amount;
    await lunch.save();
    const movement = await Movement.create({
      entityId: lunch._id,
      change: amount,
      reason,
      note,
      performedBy: performedBy || 'sistema',
      userRole: userRole || 'oficina'
    });
    res.status(201).json({ message: 'Tokens agregados y movimiento registrado', tokens: lunch.tokens, movement });
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar tokens y registrar movimiento' });
  }
});

// PATCH /api/lunch/:id/tokens
router.patch('/:id/tokens', verifyToken, allowRoles('admin', 'oficina'), async (req, res) => {
  try {
    const { delta, reason = 'ajuste manual', note = '', customDate } = req.body;
    if (typeof delta !== 'number') {
      return res.status(400).json({ error: 'El campo delta debe ser un número' });
    }
    const lunch = await Lunch.findById(req.params.id);
    if (!lunch) return res.status(404).json({ error: 'Lunch info not found' });
    // aplicar tokens
    lunch.tokens += delta;
    // actualizar status si no está bloqueado
    if (lunch.status !== 'bloqueado') {
      lunch.status = lunch.tokens > 0 ? 'con-fondos' : 'sin-fondos';
    }
    await lunch.save();
    // registrar movimiento
    const movement = await Movement.create({
      entityId: lunch._id,
      change: delta,
      reason,
      note,
      performedBy: req.user?.username || 'sistema',
      userRole: req.user?.role || 'oficina',
      timestamp: customDate ? new Date(customDate) : new Date()
    });

    let paymentInfo = null;
    // 💸 AUTO-PAGO si es "pago" y delta > 0
    if ((reason || '').toLowerCase() === 'pago' && delta > 0) {
      const prices = getPricesForLevel(lunch.level, lunch.groupName);
      const amount = Number((delta * prices.priceToken).toFixed(2));
      const ticketNumber = await Payment.generateTicketNumber();
      const payment = await Payment.create({
        entityId: lunch._id,
        movementId: movement._id,
        ticketNumber,
        amount,
        date: new Date(),
        sentEmail: false
      });
      // Uniformar nota con ticket
      await Movement.findByIdAndUpdate(movement._id, {
        note: `Pago de tokens • Total: $${amount.toFixed(2)} MXN • Ticket ${ticketNumber}`
      });
      await sendPaymentEmail(lunch, payment, 'MXN');
      paymentInfo = { ticketNumber, amount };
    }

    res.json({
      message: 'Tokens actualizados',
      tokens: lunch.tokens,
      ...(paymentInfo ? { paymentTicket: paymentInfo.ticketNumber, paymentAmount: paymentInfo.amount } : {})
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar tokens' });
  }
});

// POST /api/lunch/:id/use
router.post('/:id/use', async (req, res) => {
    try {
        const { performedBy, userRole } = req.body;
        const lunch = await Lunch.findById(req.params.id);
        if (!lunch) return res.status(404).json({ error: 'Lunch info not found' });
        const today = dayjs().startOf('day');
        // Día inválido
        const isInvalidDate = await InvalidDate.findOne({ date: today.toDate() });
        if (isInvalidDate) {
            return res.status(403).json({ error: 'Hoy es un día inválido (fin de semana o puente). No se puede registrar consumo.' });
        }
        // Periodo especial activo
        const inPeriod = lunch.hasSpecialPeriod && lunch.specialPeriod &&
            dayjs(lunch.specialPeriod.startDate).isSameOrBefore(today) &&
            dayjs(lunch.specialPeriod.endDate).isSameOrAfter(today);

        // Previene doble uso en el día (solo si no está en periodo especial)
        if (!inPeriod) {
            const existingTodayUse = await Movement.findOne({
                entityId: lunch._id,
                reason: { $in: ['uso', 'uso-con-deuda'] },
                timestamp: { $gte: today.toDate(), $lt: today.add(1, 'day').toDate() }
            });
            if (existingTodayUse) {
                return res.status(403).json({ error: 'Ya se registró un consumo para este usuario hoy.' });
            }
        }

        // Always send email, including admin/manual uses
        if (inPeriod) {
            // No descuenta token, solo permite comer
            await Movement.create({
                entityId: lunch._id,
                change: 0,
                reason: 'periodo',
                note: 'Consumo con periodo especial',
                performedBy: performedBy || 'sistema',
                userRole: userRole || 'cocina',
                timestamp: new Date()
            });
            // Send use email (always)
            await sendUseEmail(lunch, {
                type: 'periodo',
                date: new Date(),
                performedBy: performedBy || 'sistema',
                userRole: userRole || 'cocina',
                tokens: lunch.tokens,
                note: 'Consumo con periodo especial'
            });
            return res.json({
                canEat: true,
                method: 'period',
                message: 'Tiene un periodo activo. Puede desayunar.',
                tokens: lunch.tokens
            });
        }

        const wouldHave = lunch.tokens - 1;
        // apply
        lunch.tokens = wouldHave;
        if (lunch.tokens === 0 && lunch.status === 'con-fondos') {
            lunch.status = 'sin-fondos';
        }
        await lunch.save();
        const isDebt = lunch.tokens < 0;
        await Movement.create({
            entityId: lunch._id,
            change: -1,
            reason: isDebt ? 'uso-con-deuda' : 'uso',
            note: isDebt ? 'Consumo con deuda' : 'Consumo registrado sin periodo activo',
            performedBy: performedBy || 'sistema',
            userRole: userRole || 'cocina',
            timestamp: new Date()
        });
        // Send use email after successful use (always, including admin)
        await sendUseEmail(lunch, {
            type: isDebt ? 'uso-con-deuda' : 'uso',
            date: new Date(),
            performedBy: performedBy || 'sistema',
            userRole: userRole || 'cocina',
            tokens: lunch.tokens,
            note: isDebt ? 'Consumo con deuda' : 'Consumo registrado sin periodo activo'
        });
        res.json({
            canEat: true,
            method: isDebt ? 'deuda' : 'token',
            message: isDebt ? 'No tenía tokens. Se registró deuda.' : 'Usó un token. Puede desayunar.',
            tokens: lunch.tokens
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al registrar consumo' });
    }
});

// PATCH /api/lunch/:id/period
router.patch('/:id/period', verifyToken, allowRoles('admin', 'oficina'), async (req, res) => {
  try {
    const { startDate, endDate, reason, note } = req.body;
    const lunch = await Lunch.findById(req.params.id);
    if (!lunch) return res.status(404).json({ error: 'Lunch info not found' });
    const today = dayjs().startOf('day');
    // ❌ Eliminar periodo (solo si está activo)
    if (!startDate || !endDate) {
      const existingStart = dayjs(lunch.specialPeriod?.startDate);
      const existingEnd = dayjs(lunch.specialPeriod?.endDate);
      const isCurrentActive = lunch.hasSpecialPeriod &&
        existingStart.isValid() && existingEnd.isValid() &&
        existingStart.isSameOrBefore(today) && existingEnd.isSameOrAfter(today);
      if (!isCurrentActive) {
        return res.status(403).json({ error: 'Solo se puede eliminar el periodo especial si está actualmente activo.' });
      }
      lunch.hasSpecialPeriod = false;
      lunch.specialPeriod = { startDate: null, endDate: null };
      if (lunch.status === 'periodo-activo') {
        lunch.status = lunch.tokens > 0 ? 'con-fondos' : 'sin-fondos';
      }
      await lunch.save();
      await Movement.create({
        entityId: lunch._id,
        change: 0,
        reason: 'periodo-removido',
        note: 'Periodo especial eliminado',
        performedBy: req.user?.username || 'sistema',
        userRole: req.user?.role || 'sistema',
        timestamp: new Date()
      });
      await PeriodLog.deleteMany({
        lunchId: lunch._id,
        startDate: {
          $gte: existingStart.startOf('day').toDate(),
          $lte: existingStart.endOf('day').toDate()
        },
        endDate: {
          $gte: existingEnd.startOf('day').toDate(),
          $lte: existingEnd.endOf('day').toDate()
        }
      });
      return res.json({
        message: 'Periodo especial eliminado',
        hasSpecialPeriod: false,
        specialPeriod: null
      });
    }
    // ✅ Crear/actualizar periodo
    const start = dayjs(startDate).startOf('day');
    const end   = dayjs(endDate).endOf('day');
    if (!start.isValid() || !end.isValid()) {
      return res.status(400).json({ error: 'Fechas del periodo inválidas.' });
    }
    if (end.isBefore(start)) {
      return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la de inicio.' });
    }
    if (lunch.tokens < 0) {
      return res.status(400).json({ error: 'No se puede asignar un periodo especial si el usuario tiene saldo negativo.' });
    }
    const invalidSet = await getInvalidSet();
    if (invalidSet.has(start.format('YYYY-MM-DD')) || invalidSet.has(dayjs(endDate).format('YYYY-MM-DD'))) {
      return res.status(400).json({ error: 'El periodo no puede comenzar ni terminar en un día inválido.' });
    }
    const validDayCount = countValidDays(start, end, invalidSet);
    if (validDayCount < 5) {
      return res.status(400).json({ error: `El periodo debe incluir al menos 5 días válidos. Actualmente incluye ${validDayCount}.` });
    }
    // ❗ Evitar solapamiento con historial si ya hay periodo activo
    if (lunch.hasSpecialPeriod && lunch.specialPeriod?.startDate && lunch.specialPeriod?.endDate) {
      const previousPeriods = await PeriodLog.find({ lunchId: lunch._id });
      const overlapPeriod = previousPeriods.some(log => {
        const logStart = dayjs(log.startDate).startOf('day');
        const logEnd = dayjs(log.endDate).startOf('day');
        return start.isSameOrBefore(logEnd) && end.isSameOrAfter(logStart);
      });
      if (overlapPeriod) {
        return res.status(400).json({ error: 'El nuevo periodo se solapa con uno ya registrado en el historial.' });
      }
    }
    // Guardar periodo en lunch
    lunch.specialPeriod = { startDate: start.toDate(), endDate: end.toDate() };
    lunch.hasSpecialPeriod = start.isSameOrBefore(today) && end.isSameOrAfter(today);
    if (lunch.hasSpecialPeriod) lunch.status = 'periodo-activo';
    await lunch.save();
    // Logs
    await PeriodLog.create({
      lunchId: lunch._id,
      startDate: start.toDate(),
      endDate: end.toDate(),
      note: note || '',
      reason: reason || 'ajuste manual',
      performedBy: req.user?.username || 'sistema',
      userRole: req.user?.role || 'sistema'
    });
    const move = await Movement.create({
      entityId: lunch._id,
      change: 0,
      reason: reason || 'ajuste manual',
      note: `Periodo especial del ${start.format('YYYY-MM-DD')} al ${end.format('YYYY-MM-DD')} - ${note || ''}`,
      performedBy: req.user?.username || 'sistema',
      userRole: req.user?.role || 'sistema',
      timestamp: new Date()
    });

    let paymentInfo = null;
    // 💸 AUTO-PAGO si reason === 'pago'
    if ((reason || '').toLowerCase() === 'pago') {
      const prices = getPricesForLevel(lunch.level, lunch.groupName);
      const amount = Number((validDayCount * prices.pricePeriod).toFixed(2));
      const ticketNumber = await Payment.generateTicketNumber();
      const payment = await Payment.create({
        entityId: lunch._id,
        movementId: move._id,
        ticketNumber,
        amount,
        date: new Date(),
        sentEmail: false
      });
      // Dejar nota con ticket
      await Movement.findByIdAndUpdate(move._id, {
        note: `Pago de periodo (${start.format('YYYY-MM-DD')} → ${end.format('YYYY-MM-DD')}) • Total: $${amount.toFixed(2)} MXN • Ticket ${ticketNumber}`
      });
      await sendPaymentEmail(lunch, payment, 'MXN');
      paymentInfo = { ticketNumber, amount };
    }

    res.json({
      message: 'Periodo especial actualizado',
      hasSpecialPeriod: lunch.hasSpecialPeriod,
      specialPeriod: lunch.specialPeriod,
      ...(paymentInfo ? { paymentTicket: paymentInfo.ticketNumber, paymentAmount: paymentInfo.amount } : {})
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al actualizar el periodo' });
  }
});

// DELETE /api/lunch/:id/period
router.delete('/:id/period', verifyToken, allowRoles('admin', 'oficina'), async (req, res) => {
  try {
    const lunch = await Lunch.findById(req.params.id);
    if (!lunch) return res.status(404).json({ error: 'Lunch info not found' });
    lunch.hasSpecialPeriod = false;
    lunch.specialPeriod = { startDate: null, endDate: null };
    if (lunch.status === 'periodo-activo') {
      lunch.status = lunch.tokens > 0 ? 'con-fondos' : 'sin-fondos';
    }
    await lunch.save();
    await TokenMovement.create({
      lunchId: lunch._id,
      change: 0,
      reason: 'periodo-removido',
      note: 'Periodo especial eliminado',
      performedBy: req.user?.username || 'sistema',
      userRole: req.user?.role || 'sistema'
    });
    res.json({ message: 'Periodo especial eliminado', hasSpecialPeriod: false, specialPeriod: null });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al eliminar el periodo especial' });
  }
});

// GET /api/lunch/:id/period-logs
router.get('/:id/period-logs', verifyToken, async (req, res) => {
  try {
    const logs = await PeriodLog.find({ lunchId: req.params.id }).sort({ startDate: 1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener historial de periodos' });
  }
});

module.exports = router;
