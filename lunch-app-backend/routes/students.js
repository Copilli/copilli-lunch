const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const TokenMovement = require('../models/TokenMovement');
const PeriodLog = require('../models/PeriodLog');
const InvalidDate = require('../models/InvalidDate');

const dayjs = require('dayjs');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const { verifyToken, allowRoles } = require('../middleware/auth');

const VALID_STATUSES = ['periodo-activo', 'con-fondos', 'sin-fondos', 'bloqueado'];
const VALID_LEVELS = ['preescolar', 'primaria', 'secundaria'];

// Obtener todos los estudiantes o buscar por nombre/grupo
router.get('/', async (req, res) => {
  try {
    const { name, groupName, level } = req.query;

    const filter = {};

    if (name) {
      filter.name = new RegExp(name, 'i');
    }

    if (groupName) {
      filter['group.name'] = groupName;
    }

    if (level) {
      filter['group.level'] = level;
    }

    const students = await Student.find(filter);
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
});

// Crear un nuevo estudiante
router.post('/', async (req, res) => {
  try {
    const newStudent = new Student(req.body);
    await newStudent.save();
    res.status(201).json(newStudent);
  } catch (err) {
    res.status(400).json({ error: 'Error al crear estudiante' });
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
          await Student.updateOne({ studentId: stu.studentId }, { $set: stu });
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

// PATCH /api/students/:id/tokens
router.patch('/:id/tokens', async (req, res) => {
  try {
    const {
      delta,
      reason = 'ajuste manual',
      note = '',
      performedBy,
      userRole = 'oficina',
      customDate
    } = req.body;

    if (typeof delta !== 'number') {
      return res.status(400).json({ error: 'El campo delta debe ser un número' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    if (student.status === 'bloqueado' && delta < 0) {
      return res.status(403).json({ error: 'Este estudiante está bloqueado y no puede registrar consumo en negativo.' });
    }

    student.tokens += delta;

    // No cambiar status si está bloqueado
    if (student.status !== 'bloqueado') {
      if (student.tokens > 0) {
        student.status = 'con-fondos';
      } else if (student.tokens <= 0) {
        student.status = 'sin-fondos';
      }
    }

    await student.save();

    const movement = new TokenMovement({
      studentId: student.studentId,
      change: delta,
      reason,
      note,
      performedBy,
      userRole,
      timestamp: customDate ? new Date(customDate) : new Date()
    });

    await movement.save();

    res.json({
      message: 'Tokens actualizados',
      tokens: student.tokens
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar tokens' });
  }
});

// POST /api/students/:id/use
router.post('/:id/use', async (req, res) => {
  try {
    const { performedBy, userRole } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    const today = dayjs().startOf('day');

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
      timestamp: {
        $gte: today.toDate(),
        $lt: today.add(1, 'day').toDate()
      }
    });

    if (inPeriod) {
      return res.json({
        canEat: true,
        method: 'period',
        message: 'Tiene un periodo activo. Puede desayunar.',
        tokens: student.tokens
      });
    }

    if (student.status === 'bloqueado' && wouldHave < 0 && userRole !== 'admin') {
      return res.status(403).json({
        error: 'Este estudiante está bloqueado y no puede registrar consumo en negativo.'
      });
    }

    if (existingTodayUse) {
      return res.status(403).json({
        error: 'Ya se registró un consumo para este estudiante hoy.'
      });
    }

    student.tokens = wouldHave;

    if (student.tokens === 0 && student.status === 'con-fondos') {
      student.status = 'sin-fondos';
    }

    await student.save();

    const isDebt = student.tokens < 0;

    const movement = new TokenMovement({
      studentId: student.studentId,
      change: -1,
      reason: isDebt ? 'uso-con-deuda' : 'uso',
      note: isDebt ? 'Consumo con deuda' : 'Consumo registrado sin periodo activo',
      performedBy,
      userRole: 'cocina'
    });

    await movement.save();

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

// PATCH /api/students/:id/period
router.patch('/:id/period', verifyToken, allowRoles('admin', 'oficina'), async (req, res) => {
  try {
    const { startDate, endDate, reason, note, performedBy, userRole } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    const today = dayjs().startOf('day');

    if (!startDate || !endDate) {
      const existingStart = dayjs(student.specialPeriod?.startDate);
      const existingEnd = dayjs(student.specialPeriod?.endDate);

      const isCurrentActive = student.hasSpecialPeriod &&
        existingStart.isSameOrBefore(today) &&
        existingEnd.isSameOrAfter(today);

      if (!isCurrentActive) {
        return res.status(403).json({ error: 'Solo se puede eliminar el periodo especial si está actualmente activo.' });
      }

      student.hasSpecialPeriod = false;
      student.specialPeriod = { startDate: null, endDate: null };

      if (student.status === 'periodo-activo') {
        student.status = 'sin-fondos';
      }

      await student.save();

      const log = new TokenMovement({
        studentId: student.studentId,
        change: 0,
        reason: 'periodo-removido',
        note: 'Periodo especial eliminado',
        performedBy: performedBy || 'sistema',
        userRole: userRole || 'sistema'
      });
      await log.save();

      await PeriodLog.deleteMany({
        studentId: student.studentId,
        startDate: existingStart.toDate(),
        endDate: existingEnd.toDate()
      });

      return res.json({
        message: 'Periodo especial eliminado',
        hasSpecialPeriod: false,
        specialPeriod: null
      });
    }

    const parsedStart = dayjs(startDate);
    const parsedEnd = dayjs(endDate);

    if (!parsedStart.isValid() || !parsedEnd.isValid()) {
      return res.status(400).json({ error: 'Fechas del periodo inválidas.' });
    }

    const start = parsedStart.startOf('day');
    const end = parsedEnd.endOf('day');

    if (end.isBefore(start)) {
      return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la de inicio.' });
    }

    if (student.tokens < 0) {
      return res.status(400).json({
        error: 'No se puede asignar un periodo especial si el estudiante tiene saldo negativo.'
     });
    }

    // 🚫 Verificar días inválidos
    const invalidDatesDocs = await InvalidDate.find({});
    const invalidSet = new Set(invalidDatesDocs.map(doc => dayjs(doc.date).format('YYYY-MM-DD')));

    if (invalidSet.has(start.format('YYYY-MM-DD')) || invalidSet.has(end.format('YYYY-MM-DD'))) {
      return res.status(400).json({ error: 'El periodo no puede comenzar ni terminar en un día inválido.' });
    }

    // ✅ Verificar al menos 5 días válidos
    let validDayCount = 0;
    let cursor = start.clone();
    while (cursor.isSameOrBefore(end, 'day')) {
      const dayStr = cursor.format('YYYY-MM-DD');
      if (!invalidSet.has(dayStr)) {
        validDayCount++;
      }
      cursor = cursor.add(1, 'day');
    }

    if (validDayCount < 5) {
      return res.status(400).json({ error: `El periodo debe incluir al menos 5 días válidos. Actualmente incluye solo ${validDayCount}.` });
    }

    // ❗ Verificar solapamiento con logs anteriores
    if (
      student.hasSpecialPeriod &&
      student.specialPeriod &&
      student.specialPeriod.startDate &&
      student.specialPeriod.endDate
    ) {
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

    student.specialPeriod = { startDate: start.toDate(), endDate: end.toDate() };
    student.hasSpecialPeriod = start.isSameOrBefore(today) && end.isSameOrAfter(today);

    if (student.hasSpecialPeriod) {
      student.status = 'periodo-activo';
    }

    await student.save();

    try {
      const log = new PeriodLog({
        studentId: student.studentId || student._id.toString(),
        startDate: start.toDate(),
        endDate: end.toDate(),
        note: note || '',
        reason: reason || 'ajuste manual',
        performedBy: performedBy || 'sistema',
        userRole: userRole || 'sistema'
      });
      await log.save();
    } catch (logErr) {
      console.error('[❌ PeriodLog ERROR]', logErr);
    }

    try {
      const movement = new TokenMovement({
        studentId: student.studentId,
        change: 0,
        reason: reason || 'ajuste manual',
        note: `Periodo especial del ${start.format('YYYY-MM-DD')} al ${end.format('YYYY-MM-DD')} - \n${note || ''}`,
        performedBy: performedBy || 'sistema',
        userRole: userRole || 'sistema'
      });
      await movement.save();
    } catch (movementErr) {
      console.error('[❌ movement ERROR]', movementErr);
    }

    res.json({
      message: 'Periodo especial actualizado',
      hasSpecialPeriod: student.hasSpecialPeriod,
      specialPeriod: student.specialPeriod
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

    const log = new TokenMovement({
      studentId: student.studentId,
      change: 0,
      reason: 'periodo-removido',
      note: 'Periodo especial eliminado',
      performedBy: req.user?.username || 'sistema',
      userRole: req.user?.role || 'sistema'
    });
    await log.save();

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


router.get('/:id/period-logs', verifyToken, async (req, res) => {
  try {
    const logs = await PeriodLog.find({ studentId: req.params.id }).sort({ startDate: 1 });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial de periodos' });
  }
});

router.put('/:id', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const updated = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Error al actualizar datos del estudiante' });
  }
});

module.exports = router;
