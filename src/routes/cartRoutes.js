const express = require('express');
const router = express.Router();
const { getCartByUserId, addProductToCart, updateCartItem, removeProductFromCart, clearCart } = require('../controllers/cartController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, getCartByUserId);
router.post('/', authMiddleware, addProductToCart);
router.put('/:productId', authMiddleware, updateCartItem);
router.delete('/:productId', authMiddleware, removeProductFromCart);
router.delete('/', authMiddleware, clearCart);

module.exports = router;

