const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const {
  readTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} = require('../utils/commandStore');

// GET /api/command-templates — list custom command templates (any authenticated user)
router.get('/', (req, res) => {
  res.json({ success: true, templates: readTemplates() });
});

// POST /api/command-templates — create (admin only)
router.post('/', requireAdmin, (req, res) => {
  try {
    const template = createTemplate(req.body || {});
    res.json({ success: true, template });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/command-templates/:id — update (admin only)
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const template = updateTemplate(req.params.id, req.body || {});
    res.json({ success: true, template });
  } catch (err) {
    const status = err.message === 'Command not found' ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

// DELETE /api/command-templates/:id — delete (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

module.exports = router;
