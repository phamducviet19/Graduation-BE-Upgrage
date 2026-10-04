const express = require('express');
const router = express.Router();
const { getAllAttributes, getAttributeById, createAttributes, updateAttribute, deleteAttribute, getAttributesByCategory } = require('../controllers/attributeController');
const {authMiddleware, authorizeRole} = require('../middlewares/authMiddleware');

router.get('/', getAllAttributes);
router.get('/category/:categoryId', getAttributesByCategory);
router.get('/:id', getAttributeById);
router.post('/', authMiddleware, authorizeRole(['admin']), createAttributes);
router.put('/:id', authMiddleware, authorizeRole(['admin']), updateAttribute);
router.delete('/:id', authMiddleware, authorizeRole(['admin']), deleteAttribute);

module.exports = router;