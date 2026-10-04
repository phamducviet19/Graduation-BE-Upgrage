const express = require('express');
const router = express.Router();
const { createPaymentUrl, vnpayReturn, getAllPayments, getPaymentById, getPaymentsByOrder, getMyPayments, getMyPaymentById} = require('../controllers/paymentController');
const { authMiddleware, authorizeRole } = require('../middlewares/authMiddleware');

// Tạo URL thanh toán (tạo link QR hoặc redirect)
router.post('/create', createPaymentUrl);

// Xử lý callback khi VNPAY trả về (returnURL)
router.get('/vnpay_return', vnpayReturn);

// =========================
// Admin routes
// =========================
router.get('/', authMiddleware, authorizeRole(['admin']), getAllPayments);
router.get('/order/:order_id', authMiddleware, authorizeRole(['admin']), getPaymentsByOrder);
router.get('/:id', authMiddleware, authorizeRole(['admin']), getPaymentById);

// =========================
// Client routes (chỉ cần đăng nhập, không cần authorizeRole)
// =========================
router.get('/me/all', authMiddleware, getMyPayments);
router.get('/me/:id', authMiddleware, getMyPaymentById);

module.exports = router;
