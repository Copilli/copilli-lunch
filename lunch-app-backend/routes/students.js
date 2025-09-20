// routes/students.js
const express = require('express');
const router = express.Router();
const Student = require('../models/Student');

// GET student-specific info by entityId
router.get('/:entityId', async (req, res) => {
  try {
    const student = await Student.findOne({ person: req.params.entityId }).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update student-specific info
router.put('/:entityId', async (req, res) => {
  try {
    const updated = await Student.findOneAndUpdate(
      { person: req.params.entityId },
      req.body,
      { new: true }
    ).lean();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
