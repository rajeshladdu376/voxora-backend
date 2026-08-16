const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');

const {
  getAllLeads,
  getLeadById,
  getLeadsByClient,
  createLeadHandler,
  updateLead,
  deleteLead,
} = require('../controllers/leadsController');

// GET /api/leads
router.get('/', authMiddleware, getAllLeads);

// GET /api/leads/client/:clientId
router.get('/client/:clientId', authMiddleware, getLeadsByClient);

// GET /api/leads/:id
router.get('/:id', authMiddleware, getLeadById);

// POST /api/leads
router.post('/', authMiddleware, createLeadHandler);

// PUT /api/leads/:id
router.put('/:id', authMiddleware, updateLead);

// DELETE /api/leads/:id
router.delete('/:id', authMiddleware, deleteLead);

module.exports = router;