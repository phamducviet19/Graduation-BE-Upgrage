const { Wishlist, Product, ProductImage } = require("../models");

// Lấy danh sách wishlist của user
// controller/wishlist.js (hoặc file phù hợp)
exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user.id; // lấy từ token

    const wishlist = await Wishlist.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Product,
          include: [
            {
              model: ProductImage,
              as: "images", // giữ giống alias bạn đã dùng ở getProductById
              attributes: ["id", "image_url", "is_main", "created_at"],
              required: false,
            },
            // nếu bạn muốn thêm thuộc tính sản phẩm cũng có thể include ở đây
            // {
            //   model: ProductAttributeValue,
            //   include: [ProductAttribute],
            //   required: false
            // }
          ],
        },
      ],
    });

    // Chuẩn hóa output: convert images thành mảng image_url và thêm mainImage
    const formatted = wishlist.map((item) => {
      // item có thể là instance Sequelize; dùng toJSON để dễ xử lý
      const data = item.toJSON();

      if (data.Product) {
        const prod = data.Product;
        const imgs = prod.images || []; // mảng các object { id, image_url, is_main, ... }

        const imageUrls = imgs.map((img) => img.image_url);
        const mainImage = imgs.find((img) => img.is_main)?.image_url || null;

        // Ghi đè fields images / thêm mainImage
        prod.images = imageUrls;
        prod.mainImage = mainImage;
      }

      return data;
    });

    res.json(formatted);
  } catch (error) {
    console.error("Error getWishlist:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Thêm sản phẩm vào wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.body;

    // Check trùng
    const existing = await Wishlist.findOne({
      where: { user_id: userId, product_id }
    });
    if (existing) {
      return res.status(400).json({ message: "Product already in wishlist" });
    }

    const item = await Wishlist.create({ user_id: userId, product_id });
    res.status(201).json({ message: "Added to wishlist", item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Xoá sản phẩm khỏi wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.params;

    const deleted = await Wishlist.destroy({
      where: { user_id: userId, product_id }
    });

    if (!deleted) {
      return res.status(404).json({ message: "Product not found in wishlist" });
    }

    res.json({ message: "Removed from wishlist" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
