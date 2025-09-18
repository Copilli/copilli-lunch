const express = require('express');
const router = express.Router();
const Person = require('../models/Person');
const Student = require('../models/Student');
const Staff = require('../models/Staff');

const Lunch = require('../models/Lunch');
const Movement = require('../models/Movement');
const PeriodLog = require('../models/PeriodLog');
const Payment = require('../models/Payment');

// Helper: flatten person+student/staff+lunch for flat responses
function toFlatPerson(p, extra, lunch) {
  return {
    personId: p.personId || '',
    name: p.name || '',
    email: p.email || '',
    type: p.type || '',
    level: p.group?.level || '',
    groupName: p.group?.name || '',
    photoUrl: p.photoUrl || '',
    ...extra,
    lunch: lunch || {}
  };
}

// GET all persons, with optional filtering by type, level, group
router.get('/', async (req, res) => {
  try {
    const { type, level, group, flat } = req.query;
    let filter = {};
    if (type) filter.type = type;
    if (level) filter['group.level'] = level;
    if (group) filter['group.name'] = group;
    const persons = await Person.find(filter).lean();
    // Populate student/staff and lunch info
    const results = await Promise.all(persons.map(async p => {
      let extra = {};
      if (p.type === 'student') {
        extra = await Student.findOne({ person: p._id }).lean() || {};
      } else if (p.type === 'staff') {
        extra = await Staff.findOne({ person: p._id }).lean() || {};
      }
      const lunch = await Lunch.findOne({ person: p._id }).lean() || {};
      return flat === '1' || flat === 'true' ? toFlatPerson(p, extra, lunch) : { ...p, ...extra, lunch };
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// PUT /api/persons/:id - update a person by id
router.put('/:id', async (req, res) => {
  try {
    const updated = await Person.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Error al actualizar datos de la persona', detail: err.message });
  }
});

// POST bulk import persons (flat CSV support, minimal and full data, use provided IDs)
router.post('/import-bulk', async (req, res) => {
  try {
    const persons = req.body;
    if (!Array.isArray(persons)) {
      return res.status(400).json({ error: 'Formato incorrecto. Se esperaba un arreglo de personas.' });
    }
    const results = { created: 0, updated: 0, errores: [] };
    for (let p of persons) {
      try {
        // Support flat CSV: map flat fields to nested structure if needed
        if (!p.group && (p['group.level'] || p['group.name'])) {
          p.group = { level: p['group.level'] || '', name: p['group.name'] || '' };
        }
        if (!p.lunch && (
          p['lunch.tokens'] !== undefined ||
          p['lunch.hasSpecialPeriod'] !== undefined ||
          p['lunch.specialPeriod.startDate'] !== undefined ||
          p['lunch.specialPeriod.endDate'] !== undefined ||
          p['lunch.status'] !== undefined
        )) {
          p.lunch = {
            tokens: Number(p['lunch.tokens']) || 0,
            hasSpecialPeriod: (p['lunch.hasSpecialPeriod'] === true || p['lunch.hasSpecialPeriod'] === 'TRUE' || p['lunch.hasSpecialPeriod'] === 'true'),
            specialPeriod: {
              startDate: p['lunch.specialPeriod.startDate'] || null,
              endDate: p['lunch.specialPeriod.endDate'] || null
            },
            status: p['lunch.status'] || 'sin-fondos'
          };
        }
        // Minimal data: allow creation with just name, email, type, group
        if (!p.type) p.type = 'student';
        if (!p.group) p.group = { level: '', name: '' };
        if (!p.lunch) p.lunch = { tokens: 0, hasSpecialPeriod: false, specialPeriod: { startDate: null, endDate: null }, status: 'sin-fondos' };
        if (!p.name || !p.email) {
          throw new Error(`Faltan campos obligatorios (name, email) para registro`);
        }
        // Validate lunch status
        const VALID_STATUSES = ['periodo-activo', 'con-fondos', 'sin-fondos', 'bloqueado'];
        if (!VALID_STATUSES.includes(p.lunch.status)) p.lunch.status = 'sin-fondos';
        // Validate period if present
        if (p.lunch.hasSpecialPeriod) {
          const dayjs = require('dayjs');
          const start = dayjs(p.lunch.specialPeriod?.startDate);
          const end = dayjs(p.lunch.specialPeriod?.endDate);
          if (!start.isValid() || !end.isValid()) {
            throw new Error(`Fechas inválidas en periodo especial para ${p.name}`);
          }
        }
        // Use provided personId if present, else auto-generate
        let existing = null;
        if (p.personId) {
          existing = await Person.findOne({ personId: p.personId });
        }
        if (existing) {
          await Person.updateOne({ personId: p.personId }, { $set: p });
          results.updated += 1;
        } else {
          const person = new Person(p);
          await person.save();
          if (p.type === 'student') {
            await new Student({ person: person._id, ...p.student }).save();
          } else if (p.type === 'staff') {
            await new Staff({ person: person._id, ...p.staff }).save();
          }
          await new Lunch({ person: person._id, ...p.lunch }).save();
          results.created += 1;
        }
      } catch (innerErr) {
        results.errores.push(innerErr.message);
      }
    }
    res.json({ message: 'Importación completada', ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add a new person
router.post('/', async (req, res) => {
  try {
    const p = req.body;
    const person = new Person(p);
    await person.save();
    if (p.type === 'student') {
      await new Student({ person: person._id, ...p.student }).save();
    } else if (p.type === 'staff') {
      await new Staff({ person: person._id, ...p.staff }).save();
    }
    await new Lunch({ person: person._id, ...p.lunch }).save();
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a person by id and all related info
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await Person.findByIdAndDelete(id);
    await Student.deleteOne({ person: id });
    await Staff.deleteOne({ person: id });
    // Find the Lunch record for this person
    const lunch = await Lunch.findOne({ person: id });
    if (lunch) {
      const lunchId = lunch._id;
      await Lunch.deleteOne({ person: id });
  await Movement.deleteMany({ entityId: lunchId });
      await PeriodLog.deleteMany({ lunchId });
      await Payment.deleteMany({ lunchId });
    }
    res.json({ deleted: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
