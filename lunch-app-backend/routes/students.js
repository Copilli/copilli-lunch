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

// 💵 Precios por grupo/nivel
function getPricesForStudent(student) {
  const level = (student.group?.level || '').toLowerCase();
  const groupName = (student.group?.name || '').toUpperCase();

  if (level === 'preescolar') {
    return { priceToken: 44, pricePeriod: 40 };
  }
  if (level === 'secundaria') {
    return { priceToken: 62, pricePeriod: 52 };
  }
  if (level === 'primaria') {
    if (/^[1-3]/.test(groupName)) {
      return { priceToken: 50, pricePeriod: 44 };
    }
    if (/^[4-6]/.test(groupName)) {
      return { priceToken: 57, pricePeriod: 47 };
    }
    // Grupo no válido: usar el precio más alto de primaria
    return { priceToken: 57, pricePeriod: 47 };
  }
}

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
const toFlatStudent = (s) => ({
  studentId: s.studentId || '',
  name: s.name || '',
  email: s.email || '',
  level: s.group?.level || '',
  groupName: s.group?.name || '',
  tokens: typeof s.tokens === 'number' ? s.tokens : 0,
  status: s.status || 'sin-fondos',
  hasSpecialPeriod: !!s.hasSpecialPeriod,
  specialStartDate: s.specialPeriod?.startDate ? dayjs(s.specialPeriod.startDate).format('YYYY-MM-DD') : '',
  specialEndDate: s.specialPeriod?.endDate ? dayjs(s.specialPeriod.endDate).format('YYYY-MM-DD') : '',
  notes: s.notes || '',
  photoUrl: s.photoUrl || ''
});

// GET /api/students  (igual que antes, con opción ?flat=1)
router.get('/', async (req, res) => {
  try {
    const { name, groupName, level, flat } = req.query;

    const filter = {};
    if (name)       filter.name = new RegExp(name, 'i');
    if (groupName)  filter['group.name']  = groupName;
    if (level)      filter['group.level'] = level;

    const docs = await Student.find(filter)
      .sort({ 'group.level': 1, 'group.name': 1, name: 1 })
      .lean();

    if (flat === '1' || flat === 'true') {
      return res.json(docs.map(toFlatStudent));
    }

    // comportamiento original
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
});

// Crear un nuevo estudiante
router.post('/', async (req, res) => {
  try {
    const { name, email, group } = req.body;
    if (!name || !email || !group?.level || !group?.name) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: name, email, group.level y group.name' });
    }
    const newStudent = new Student(req.body); // studentId se autogenera si falta
    await newStudent.save();
    res.status(201).json(newStudent);
  } catch (err) {
    res.status(400).json({ error: 'Error al crear estudiante', detail: err.message });
  }
});


// POST /api/students/import-bulk
router.post('/import-bulk', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const students = req.body.students;
    if (!Array.isArray(students)) {
      return res.status(400).json({ error: 'Formato incorrecto. Se esperaba un arreglo de estudiantes.' });
    }

    const results = { created: 0, updated: 0, errores: [] };

    for (const stu of students) {
      try {
        if (!stu.name || !stu.email || !stu.group?.level || !stu.group?.name) {
          throw new Error(`Faltan campos obligatorios (name, email, group.level, group.name) para registro`);
        }

        // Defaults y validaciones suaves
        if (typeof stu.tokens !== 'number' || isNaN(stu.tokens)) stu.tokens = 0;
        const VALID_STATUSES = ['periodo-activo', 'con-fondos', 'sin-fondos', 'bloqueado'];
        if (!VALID_STATUSES.includes(stu.status)) stu.status = 'sin-fondos';

        // Validar periodo si viene
        if (stu.hasSpecialPeriod) {
          const start = dayjs(stu.specialPeriod?.startDate);
          const end = dayjs(stu.specialPeriod?.endDate);
          if (!start.isValid() || !end.isValid()) {
            throw new Error(`Fechas inválidas en periodo especial para ${stu.name}`);
          }
        }

        //  Si trae studentId, intentamos actualizar; si no, creamos.
        let existing = null;
        if (stu.studentId) {
          existing = await Student.findOne({ studentId: stu.studentId });
        }

        if (existing) {
          await Student.updateOne({ studentId: stu.studentId }, { $set: stu });
          results.updated += 1;
        } else {
          // studentId se autogenera en pre('save')
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

    // Permitir admins registrar consumo aunque esté bloqueado
    if (
      student.status === 'bloqueado' &&
      delta < 0 &&
      (!req.user || req.user.role !== 'admin')
    ) {
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
      const prices = getPricesForStudent(student);
      const amount = Number((delta * prices.priceToken).toFixed(2));
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
        note: `Pago de tokens • Total: $${amount.toFixed(2)} MXN • Ticket ${ticketNumber}`
      });

      await sendPaymentEmail(student, payment, 'MXN');
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
      const prices = getPricesForStudent(student);
      const amount = Number((validDayCount * prices.pricePeriod).toFixed(2));
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
        note: `Pago de periodo (${start.format('YYYY-MM-DD')} → ${end.format('YYYY-MM-DD')}) • Total: $${amount.toFixed(2)} MXN • Ticket ${ticketNumber}`
      });
      
      await sendPaymentEmail(student, payment, 'MXN');
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
