const express = require('express');
const router = express.Router();
const { 
  getRevenueByDate, 
  getTopProducts, 
  getOrderStatusCount, 
  getRevenueByCategory, 
  getTopCustomers, 
  getOrderStatusPercentage 
} = require('../controllers/statisticsController');
const { authMiddleware, authorizeRole } = require('../middlewares/authMiddleware');

// Tất cả route thống kê — chỉ admin được truy cập
router.get('/revenue', authMiddleware, authorizeRole(['admin']), getRevenueByDate);
router.get('/top-products', authMiddleware, authorizeRole(['admin']), getTopProducts);
router.get('/orders-status', authMiddleware, authorizeRole(['admin']), getOrderStatusCount);
router.get('/top-customers', authMiddleware, authorizeRole(['admin']), getTopCustomers);
router.get('/order-percentage', authMiddleware, authorizeRole(['admin']), getOrderStatusPercentage);

module.exports = router;
