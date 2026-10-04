const express = require('express');
const router = express.Router();
const { createOrder, getAllOrders, updateOrderStatus, cancelOrder } = require('../controllers/orderController');
const {authMiddleware, authorizeRole} = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, createOrder);
router.get('/', authMiddleware, getAllOrders);
router.put('/:id', authMiddleware, authorizeRole(['admin']), updateOrderStatus);
router.patch('/:id/cancel', authMiddleware, cancelOrder);

module.exports = router;


