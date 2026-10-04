const express = require('express');
const router = express.Router();
const { createImport, getAllImports, getImportById, deleteImport } = require('../controllers/importController');
const {authMiddleware, authorizeRole} = require('../middlewares/authMiddleware');

router.get('/', getAllImports);
router.get('/:id', getImportById);
router.post('/', authMiddleware, authorizeRole(['admin']), createImport);
router.delete('/:id', authMiddleware, authorizeRole(['admin']), deleteImport);

module.exports = router;