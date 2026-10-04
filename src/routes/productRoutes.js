const express = require('express');
const router = express.Router();
const multer = require('multer');
const { 
    createProduct, getProducts, getProductById, updateProduct, deleteProduct, 
    getProductsByCategory, getProductsByBrand, filterProducts,
    getFeaturedProducts, getNewArrivals, searchProducts
} = require('../controllers/productController');
const {authMiddleware, authorizeRole} = require('../middlewares/authMiddleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/products/'); // Thư mục lưu ảnh
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// Route chung
router.get('/', getProducts);

// Các route cụ thể phải đặt TRƯỚC ':id'
router.get('/category/:categoryId', getProductsByCategory);
router.get('/brand/:brandId', getProductsByBrand);
router.get('/filter', filterProducts);
router.get('/featured', getFeaturedProducts);
router.get('/new', getNewArrivals);
router.get('/search', searchProducts);

// Route theo id phải đặt CUỐI
router.get('/:id', getProductById);
router.post(
  '/',
  authMiddleware,
  authorizeRole(['admin']),
  upload.array('images', 3), // cho phép gửi tối đa 3 ảnh
  createProduct
);
router.put(
  '/:id',
  authMiddleware,
  authorizeRole(['admin']),
  upload.array('images', 3), // nhận tối đa 3 ảnh, không bắt buộc đủ
  updateProduct
);
router.delete('/:id', authMiddleware, authorizeRole(['admin']), deleteProduct);

module.exports = router;
