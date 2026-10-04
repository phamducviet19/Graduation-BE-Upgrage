const express = require('express');
const router = express.Router();
const { getAllClients, getClientById, deleteClient } = require('../controllers/customerController');
const {authMiddleware, authorizeRole} = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, authorizeRole(['admin']), getAllClients);
router.get('/:id', authMiddleware, authorizeRole(['admin']), getClientById);
router.delete('/:id', authMiddleware, authorizeRole(['admin']), deleteClient);

module.exports = router;