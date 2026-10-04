const express = require('express');
const router = express.Router();
const { createBrand, getAllBrands, getBrandById, updateBrand, deleteBrand} = require('../controllers/brandController');
const {authMiddleware, authorizeRole} = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, authorizeRole(['admin']), createBrand);
router.put('/:id', authMiddleware, authorizeRole(['admin']), updateBrand);
router.get('/', getAllBrands);
router.get('/:id', getBrandById);
router.delete('/:id', authMiddleware, authorizeRole(['admin']), deleteBrand);

module.exports = router;