const express = require('express');
const router = express.Router();
const { createPcBuild, getAllPcBuilds, getPcBuildById, updatePcBuild, deletePcBuild, buildPCWithAI } = require('../controllers/pcBuildController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, createPcBuild);
router.get('/', authMiddleware, getAllPcBuilds);
router.get('/:id', authMiddleware, getPcBuildById);
router.put('/:id', authMiddleware, updatePcBuild);
router.delete('/:id', authMiddleware, deletePcBuild);
router.post('/suggest', authMiddleware, buildPCWithAI);

module.exports = router;