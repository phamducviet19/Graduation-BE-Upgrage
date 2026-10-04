const express = require('express');
const router = express.Router();
const { getWishlist, addToWishlist, removeFromWishlist } = require('../controllers/wishlishController');
const {authMiddleware} = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, getWishlist);
router.post('/', authMiddleware, addToWishlist);
router.delete('/:product_id', authMiddleware, removeFromWishlist);

module.exports = router;