const express = require('express');
const router = express.Router();
const { getAllSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier } = require('../controllers/supplierController');
const {authMiddleware, authorizeRole} = require('../middlewares/authMiddleware');

router.get('/', getAllSuppliers);
router.get('/:id', getSupplierById);
router.post('/', authMiddleware, authorizeRole(['admin']), createSupplier);
router.put('/:id', authMiddleware, authorizeRole(['admin']), updateSupplier);
router.delete('/:id', authMiddleware, authorizeRole(['admin']), deleteSupplier);

module.exports = router;