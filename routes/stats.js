const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { getStats } = require('../controllers/statsController');

// GET /api/stats
router.get('/', authMiddleware, getStats);

module.exports = router;