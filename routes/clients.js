const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');

const {
  getAllClients,
  getClientById,
  createClientHandler,
  updateClient,
  deleteClient,
} = require('../controllers/clientsController');


// All client routes protected
router.use(authMiddleware);


// GET /api/clients
router.get('/', getAllClients);

// GET /api/clients/:id
router.get('/:id', getClientById);

// POST /api/clients
router.post('/', createClientHandler);

// PUT /api/clients/:id
router.put('/:id', updateClient);

// DELETE /api/clients/:id
router.delete('/:id', deleteClient);


module.exports = router;