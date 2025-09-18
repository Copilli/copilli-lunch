const express = require('express');
const router = express.Router();
const Staff = require('../models/Staff');
const Person = require('../models/Person');

// GET staff-specific info by personId
router.get('/:personId', async (req, res) => {
  try {
    const staff = await Staff.findOne({ person: req.params.personId }).lean();
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update staff-specific info
router.put('/:personId', async (req, res) => {
  try {
    const updated = await Staff.findOneAndUpdate(
      { person: req.params.personId },
      req.body,
      { new: true }
    ).lean();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
