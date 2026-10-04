const express = require('express');
const router = express.Router();
const { createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory} = require('../controllers/categoryController');
const {authMiddleware, authorizeRole} = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, authorizeRole(['admin']), createCategory);
router.put('/:id', authMiddleware, authorizeRole(['admin']), updateCategory);
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);
router.delete('/:id', authMiddleware, authorizeRole(['admin']), deleteCategory);

module.exports = router;