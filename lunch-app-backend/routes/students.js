// routes/students.js
const express = require('express');
const router = express.Router();

const Student = require('../models/Student');
const TokenMovement = require('../models/TokenMovement');
const PeriodLog = require('../models/PeriodLog');
const InvalidDate = require('../models/InvalidDate');
const Payment = require('../models/Payment');

const dayjs = require('dayjs');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const { verifyToken, allowRoles } = require('../middleware/auth');
const { sendPaymentEmail } = require('../utils/sendPaymentEmail');

// 💵 Precios locales
const PRICE_PER_TOKEN = 40; // MXN por token
const PRICE_PER_DAY   = 35; // MXN por día válido de periodo
const CURRENCY        = 'MXN';

const VALID_STATUSES = ['periodo-activo', 'con-fondos', 'sin-fondos', 'bloqueado'];
const VALID_LEVELS = ['preescolar', 'primaria', 'secundaria'];

/* ------------------------- Helpers ------------------------- */
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

/* ------------------------- Rutas ------------------------- */

// Obtener todos los estudiantes o buscar por nombre/grupo
router.get('/', async (req, res) => {
  try {
    const { name, groupName, level } = req.query;
    const filter = {};

    if (name) filter.name = new RegExp(name, 'i');
    if (groupName) filter['group.name'] = groupName;
    if (level) filter['group.level'] = level;

    const students = await Student.find(filter);
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
});

// Crear un nuevo estudiante (soporta email si viene)
router.post('/', async (req, res) => {
  try {
    const newStudent = new Student(req.body);
    await newStudent.save();
    res.status(201).json(newStudent);
  } catch (err) {
    res.status(400).json({ error: 'Error al crear estudiante' });
  }
});

// Importación masiva
router.post('/import-bulk', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const students = req.body.students;
    if (!Array.isArray(students)) {
      return res.status(400).json({ error: 'Formato incorrecto. Se esperaba un arreglo de estudiantes.' });
    }

    const results = { created: 0, updated: 0, errores: [] };

    for (const stu of students) {
      try {
        if (!VALID_STATUSES.includes(stu.status)) {
          throw new Error(`Status inválido para ${stu.studentId}: ${stu.status}`);
        }
        if (!stu.group || !VALID_LEVELS.includes(stu.group.level) || !stu.group.name) {
          throw new Error(`Grupo inválido o incompleto para ${stu.studentId}`);
        }
        if (typeof stu.tokens !== 'number' || isNaN(stu.tokens)) {
          throw new Error(`Tokens inválidos para ${stu.studentId}: ${stu.tokens}`);
        }
        if (stu.hasSpecialPeriod) {
          const start = dayjs(stu.specialPeriod?.startDate);
          const end = dayjs(stu.specialPeriod?.endDate);
          if (!start.isValid() || !end.isValid()) {
            throw new Error(`Fechas inválidas para ${stu.studentId}`);
          }
        }

        const existing = await Student.findOne({ studentId: stu.studentId });
        if (existing) {
          await Student.updateOne({ studentId: stu.studentId }, { $set: stu }); // email incluido si viene
          results.updated += 1;
        } else {
          await Student.create(stu);
          results.created += 1;
        }
      } catch (innerErr) {
        results.errores.push(innerErr.message);
      }
    }

    res.json({ message: 'Importación completada', ...results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al importar estudiantes' });
  }
});

// PATCH /api/students/:id/tokens  (AUTO-PAGO si reason === 'pago' y delta > 0)
router.patch('/:id/tokens', verifyToken, allowRoles('admin', 'oficina'), async (req, res) => {
  try {
    const { delta, reason = 'ajuste manual', note = '', customDate } = req.body;

    if (typeof delta !== 'number') {
      return res.status(400).json({ error: 'El campo delta debe ser un número' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    if (student.status === 'bloqueado' && delta < 0) {
      return res.status(403).json({ error: 'Este estudiante está bloqueado y no puede registrar consumo en negativo.' });
    }

    // aplicar tokens
    student.tokens += delta;

    // actualizar status si no está bloqueado
    if (student.status !== 'bloqueado') {
      student.status = student.tokens > 0 ? 'con-fondos' : 'sin-fondos';
    }
    await student.save();

    // registrar movimiento
    const movement = await TokenMovement.create({
      studentId: student.studentId,
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
      const amount = Number((delta * PRICE_PER_TOKEN).toFixed(2));
      const ticketNumber = await Payment.generateTicketNumber();

      const payment = await Payment.create({
        studentId: student.studentId,
        tokenMovementId: movement._id,
        ticketNumber,
        amount,
        date: new Date(),
        sentEmail: false
      });

      // Uniformar nota con ticket
      await TokenMovement.findByIdAndUpdate(movement._id, {
        note: `Pago de tokens • Total: $${amount.toFixed(2)} ${CURRENCY} • Ticket ${ticketNumber}`
      });

      await sendPaymentEmail(student, payment, CURRENCY);
      paymentInfo = { ticketNumber, amount };
    }

    res.json({
      message: 'Tokens actualizados',
      tokens: student.tokens,
      ...(paymentInfo ? { paymentTicket: paymentInfo.ticketNumber, paymentAmount: paymentInfo.amount } : {})
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar tokens' });
  }
});

// POST /api/students/:id/use  (consumo del día, SIN token obligatorio)
router.post('/:id/use', async (req, res) => {
  try {
    const { performedBy, userRole } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    const today = dayjs().startOf('day');

    // Día inválido
    const isInvalidDate = await InvalidDate.findOne({ date: today.toDate() });
    if (isInvalidDate) {
      return res.status(403).json({
        error: 'Hoy es un día inválido (fin de semana o puente). No se puede registrar consumo.'
      });
    }

    const inPeriod = student.hasSpecialPeriod && student.specialPeriod &&
      dayjs(student.specialPeriod.startDate).isSameOrBefore(today) &&
      dayjs(student.specialPeriod.endDate).isSameOrAfter(today);

    const wouldHave = student.tokens - 1;

    const existingTodayUse = await TokenMovement.findOne({
      studentId: student.studentId,
      reason: { $in: ['uso', 'uso-con-deuda'] },
      timestamp: { $gte: today.toDate(), $lt: today.add(1, 'day').toDate() }
    });

    if (inPeriod) {
      return res.json({
        canEat: true,
        method: 'period',
        message: 'Tiene un periodo activo. Puede desayunar.',
        tokens: student.tokens
      });
    }

    if (existingTodayUse) {
      return res.status(403).json({ error: 'Ya se registró un consumo para este estudiante hoy.' });
    }

    // Si está bloqueado y sería deuda, solo admin debería poder—como no hay token aquí, aplicamos la regla básica:
    if (student.status === 'bloqueado' && wouldHave < 0 && (userRole || 'cocina') !== 'admin') {
      return res.status(403).json({ error: 'Este estudiante está bloqueado y no puede registrar consumo en negativo.' });
    }

    // apply
    student.tokens = wouldHave;
    if (student.tokens === 0 && student.status === 'con-fondos') {
      student.status = 'sin-fondos';
    }
    await student.save();

    const isDebt = student.tokens < 0;
    await TokenMovement.create({
      studentId: student.studentId,
      change: -1,
      reason: isDebt ? 'uso-con-deuda' : 'uso',
      note: isDebt ? 'Consumo con deuda' : 'Consumo registrado sin periodo activo',
      performedBy: performedBy || 'sistema',
      userRole: userRole || 'cocina'
    });

    res.json({
      canEat: true,
      method: isDebt ? 'deuda' : 'token',
      message: isDebt ? 'No tenía tokens. Se registró deuda.' : 'Usó un token. Puede desayunar.',
      tokens: student.tokens
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar consumo' });
  }
});

// PATCH /api/students/:id/period  (AUTO-PAGO cuando reason === 'pago')
router.patch('/:id/period', verifyToken, allowRoles('admin', 'oficina'), async (req, res) => {
  try {
    const { startDate, endDate, reason, note } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    const today = dayjs().startOf('day');

    // ❌ Eliminar periodo (solo si está activo)
    if (!startDate || !endDate) {
      const existingStart = dayjs(student.specialPeriod?.startDate);
      const existingEnd = dayjs(student.specialPeriod?.endDate);

      const isCurrentActive = student.hasSpecialPeriod &&
        existingStart.isValid() && existingEnd.isValid() &&
        existingStart.isSameOrBefore(today) && existingEnd.isSameOrAfter(today);

      if (!isCurrentActive) {
        return res.status(403).json({ error: 'Solo se puede eliminar el periodo especial si está actualmente activo.' });
      }

      student.hasSpecialPeriod = false;
      student.specialPeriod = { startDate: null, endDate: null };

      if (student.status === 'periodo-activo') {
        student.status = student.tokens > 0 ? 'con-fondos' : 'sin-fondos';
      }
      await student.save();

      await TokenMovement.create({
        studentId: student.studentId,
        change: 0,
        reason: 'periodo-removido',
        note: 'Periodo especial eliminado',
        performedBy: req.user?.username || 'sistema',
        userRole: req.user?.role || 'sistema'
      });

      await PeriodLog.deleteMany({
        studentId: student.studentId,
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
    if (student.tokens < 0) {
      return res.status(400).json({ error: 'No se puede asignar un periodo especial si el estudiante tiene saldo negativo.' });
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
    if (student.hasSpecialPeriod && student.specialPeriod?.startDate && student.specialPeriod?.endDate) {
      const previousPeriods = await PeriodLog.find({ studentId: student.studentId });
      const overlapPeriod = previousPeriods.some(log => {
        const logStart = dayjs(log.startDate).startOf('day');
        const logEnd = dayjs(log.endDate).startOf('day');
        return start.isSameOrBefore(logEnd) && end.isSameOrAfter(logStart);
      });
      if (overlapPeriod) {
        return res.status(400).json({ error: 'El nuevo periodo se solapa con uno ya registrado en el historial.' });
      }
    }

    // Guardar periodo en el estudiante
    student.specialPeriod = { startDate: start.toDate(), endDate: end.toDate() };
    student.hasSpecialPeriod = start.isSameOrBefore(today) && end.isSameOrAfter(today);
    if (student.hasSpecialPeriod) student.status = 'periodo-activo';
    await student.save();

    // Logs
    await PeriodLog.create({
      studentId: student.studentId,
      startDate: start.toDate(),
      endDate: end.toDate(),
      note: note || '',
      reason: reason || 'ajuste manual',
      performedBy: req.user?.username || 'sistema',
      userRole: req.user?.role || 'sistema'
    });

    const move = await TokenMovement.create({
      studentId: student.studentId,
      change: 0,
      reason: reason || 'ajuste manual',
      note: `Periodo especial del ${start.format('YYYY-MM-DD')} al ${end.format('YYYY-MM-DD')} - ${note || ''}`,
      performedBy: req.user?.username || 'sistema',
      userRole: req.user?.role || 'sistema'
    });

    let paymentInfo = null;

    // 💸 AUTO-PAGO si reason === 'pago'
    if ((reason || '').toLowerCase() === 'pago') {
      const amount = Number((validDayCount * PRICE_PER_DAY).toFixed(2));
      const ticketNumber = await Payment.generateTicketNumber();

      const payment = await Payment.create({
        studentId: student.studentId,
        tokenMovementId: move._id,
        ticketNumber,
        amount,
        date: new Date(),
        sentEmail: false
      });

      // Dejar nota con ticket
      await TokenMovement.findByIdAndUpdate(move._id, {
        note: `Pago de periodo (${start.format('YYYY-MM-DD')} → ${end.format('YYYY-MM-DD')}) • Total: $${amount.toFixed(2)} ${CURRENCY} • Ticket ${ticketNumber}`
      });
      
      await sendPaymentEmail(student, payment, CURRENCY);
      paymentInfo = { ticketNumber, amount };
    }

    res.json({
      message: 'Periodo especial actualizado',
      hasSpecialPeriod: student.hasSpecialPeriod,
      specialPeriod: student.specialPeriod,
      ...(paymentInfo ? { paymentTicket: paymentInfo.ticketNumber, paymentAmount: paymentInfo.amount } : {})
    });
  } catch (err) {
    console.error('[❌ Period PATCH ERROR]', err);
    res.status(500).json({ error: err.message || 'Error al actualizar el periodo' });
  }
});

// DELETE /api/students/:id/period
router.delete('/:id/period', verifyToken, allowRoles('admin', 'oficina'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    const today = dayjs().startOf('day');
    const existingStart = dayjs(student.specialPeriod?.startDate);
    const existingEnd = dayjs(student.specialPeriod?.endDate);

    const isCurrentActive = student.hasSpecialPeriod &&
      existingStart.isValid() &&
      existingEnd.isValid() &&
      existingStart.isSameOrBefore(today) &&
      existingEnd.isSameOrAfter(today);

    if (!isCurrentActive) {
      return res.status(403).json({ error: 'Solo se puede eliminar el periodo especial si está actualmente activo.' });
    }

    student.hasSpecialPeriod = false;
    student.specialPeriod = { startDate: null, endDate: null };

    if (student.status === 'periodo-activo') {
      student.status = student.tokens > 0 ? 'con-fondos' : 'sin-fondos';
    }

    await student.save();

    await TokenMovement.create({
      studentId: student.studentId,
      change: 0,
      reason: 'periodo-removido',
      note: 'Periodo especial eliminado',
      performedBy: req.user?.username || 'sistema',
      userRole: req.user?.role || 'sistema'
    });

    await PeriodLog.deleteMany({
      studentId: student.studentId,
      startDate: {
        $gte: existingStart.startOf('day').toDate(),
        $lte: existingStart.endOf('day').toDate()
      },
      endDate: {
        $gte: existingEnd.startOf('day').toDate(),
        $lte: existingEnd.endOf('day').toDate()
      }
    });

    res.json({
      message: 'Periodo especial eliminado',
      hasSpecialPeriod: false,
      specialPeriod: null
    });
  } catch (err) {
    console.error('[❌ Period DELETE ERROR]', err);
    res.status(500).json({ error: err.message || 'Error al eliminar el periodo especial' });
  }
});

// Historial de periodos
router.get('/:id/period-logs', verifyToken, async (req, res) => {
  try {
    const logs = await PeriodLog.find({ studentId: req.params.id }).sort({ startDate: 1 });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial de periodos' });
  }
});

// Actualizar alumno (solo admin)
router.put('/:id', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const updated = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Error al actualizar datos del estudiante' });
  }
});

module.exports = router;
