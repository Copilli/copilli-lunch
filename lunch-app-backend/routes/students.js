const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const TokenMovement = require('../models/TokenMovement');
const dayjs = require('dayjs');
const { verifyToken, allowRoles } = require('../middleware/auth');

const VALID_STATUSES = ['periodo-activo', 'con-fondos', 'sin-fondos', 'bloqueado'];
const VALID_LEVELS = ['preescolar', 'primaria', 'secundaria'];

// Obtener todos los estudiantes o buscar por nombre/grupo
router.get('/', async (req, res) => {
  try {
    const { name, groupName, level } = req.query;

    const filter = {};

    if (name) {
      filter.name = new RegExp(name, 'i'); // búsqueda insensible a mayúsculas
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
        // ✅ Validación de status
        if (!VALID_STATUSES.includes(stu.status)) {
          throw new Error(`Status inválido para ${stu.studentId}: ${stu.status}`);
        }

        // ✅ Validación de grupo
        if (!stu.group || !VALID_LEVELS.includes(stu.group.level) || !stu.group.name) {
          throw new Error(`Grupo inválido o incompleto para ${stu.studentId}`);
        }

        // ✅ Validación de tokens
        if (typeof stu.tokens !== 'number' || isNaN(stu.tokens)) {
          throw new Error(`Tokens inválidos para ${stu.studentId}: ${stu.tokens}`);
        }

        // ✅ Validación de fechas si hay periodo
        if (stu.hasSpecialPeriod) {
          const start = dayjs(stu.specialPeriod?.startDate);
          const end = dayjs(stu.specialPeriod?.endDate);
          if (!start.isValid() || !end.isValid()) {
            throw new Error(`Fechas inválidas para ${stu.studentId}`);
          }
        }

        // ✅ Crear o actualizar
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

// Actualizar tokens (sumar o restar)
// PATCH /api/students/:id/tokens
router.patch('/:id/tokens', async (req, res) => {
  try {
    const {
      delta,
      reason = 'ajuste manual',
      note = '',
      performedBy,
      userRole = 'oficina' // puedes ajustar según autenticación
    } = req.body;

    if (typeof delta !== 'number') {
      return res.status(400).json({ error: 'El campo delta debe ser un número' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    if (student.status === 'bloqueado' && delta < 0) {
      return res.status(403).json({ error: 'Este estudiante está bloqueado y no puede registrar consumo en negativo.' });
    }

    // Aplicar cambio
    student.tokens += delta;
    await student.save();

    // Registrar movimiento
    const movement = new TokenMovement({
      studentId: student.studentId,
      change: delta,
      reason,
      note,
      performedBy,
      userRole
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
    const { performedBy } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    const today = dayjs().startOf('day');

    // Validar si tiene periodo activo
    const inPeriod =
      student.hasSpecialPeriod &&
      student.specialPeriod &&
      dayjs(student.specialPeriod.startDate).isSameOrBefore(today) &&
      dayjs(student.specialPeriod.endDate).isSameOrAfter(today);

    if (inPeriod) {
      return res.json({
        canEat: true,
        method: 'period',
        message: 'Tiene un periodo activo. Puede desayunar.',
        tokens: student.tokens
      });
    }

    // ✅ Validar si el estudiante está bloqueado
    if (student.status === 'bloqueado') {
      return res.status(403).json({
        error: 'Este estudiante está bloqueado y no puede registrar consumo sin un periodo activo.'
      });
    }

    // No tiene periodo → usar o endeudar tokens
    student.tokens -= 1;
    await student.save();

    const movement = new TokenMovement({
      studentId: student.studentId,
      change: -1,
      reason: 'uso',
      note: 'Consumo registrado sin periodo activo',
      performedBy,
      userRole: 'cocina'
    });

    await movement.save();

    res.json({
      canEat: true,
      method: student.tokens >= 0 ? 'token' : 'deuda',
      message:
        student.tokens >= 0
          ? 'Usó un token. Puede desayunar.'
          : 'No tenía tokens. Se registró deuda.',
      tokens: student.tokens
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar consumo' });
  }
});

// PATCH /api/students/:id/period
router.patch('/:id/period', verifyToken, allowRoles('admin', 'oficina'), async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Ambas fechas son requeridas' });
    }

    const today = dayjs().startOf('day');
    const end = dayjs(endDate).startOf('day');

    // ❌ No permitir periodos que ya terminaron
    if (end.isBefore(today)) {
      return res.status(400).json({ error: 'No se puede asignar un periodo que ya terminó.' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    student.specialPeriod = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    // ✅ Activar o desactivar automáticamente
    student.hasSpecialPeriod = end.isSameOrAfter(today);

    await student.save();
    res.json({
      message: 'Periodo especial actualizado',
      hasSpecialPeriod: student.hasSpecialPeriod,
      specialPeriod: student.specialPeriod
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el periodo' });
  }
});

// Editar estudiante
router.put('/:id', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    const updated = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Error al actualizar datos del estudiante' });
  }
});

module.exports = router;
