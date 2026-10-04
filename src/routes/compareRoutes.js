const express = require("express");
const router = express.Router();
const { addToCompare, getCompareList, removeFromCompare, compareWithAI } = require("../controllers/compareController");
const { authMiddleware } = require("../middlewares/authMiddleware");

router.post("/", authMiddleware, addToCompare);        // thêm sản phẩm
router.get("/", authMiddleware, getCompareList);       // lấy danh sách so sánh (theo category)
router.delete("/:productId", authMiddleware, removeFromCompare); // xóa 1 sản phẩm
router.post("/ai", authMiddleware, compareWithAI); // so sánh sản phẩm với AI

module.exports = router;
