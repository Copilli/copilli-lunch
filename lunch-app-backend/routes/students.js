const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const TokenMovement = require('../models/TokenMovement');
const dayjs = require('dayjs');
const { verifyToken, allowRoles } = require('../middleware/auth');


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

    const results = { created: 0, updated: 0 };

    for (const stu of students) {
      const existing = await Student.findOne({ studentId: stu.studentId });

      if (existing) {
        await Student.updateOne({ studentId: stu.studentId }, { $set: stu });
        results.updated += 1;
      } else {
        await Student.create(stu);
        results.created += 1;
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

// Editar estudiante (opcional)
router.put('/:id', async (req, res) => {
  try {
    const updated = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Error al actualizar datos del estudiante' });
  }
});

module.exports = router;
