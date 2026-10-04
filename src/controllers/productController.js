const { Op } = require("sequelize");
const { Product, ProductAttribute, ProductAttributeValue, ProductImage } = require("../models");

exports.createProduct = async (req, res) => {
  try {
    let { name, description, price, brand_id, category_id, attributes } = req.body;

// Parse JSON nếu là string (multipart/form-data)
if (typeof attributes === "string") {
  try {
    attributes = JSON.parse(attributes);
  } catch (err) {
    return res.status(400).json({ message: "Invalid JSON format in attributes" });
  }
}

    const product = await Product.create({
      name,
      description,
      price,
      stock: 0,
      brand_id,
      category_id
    });
    if (attributes && Array.isArray(attributes)) {
      for (const attr of attributes) {
        await ProductAttributeValue.create({
          product_id: product.id,
          attribute_id: attr.attribute_id,
          value_text: attr.value_text || null,
          value_number: attr.value_number || null,
          value_boolean: attr.value_boolean || null
        });
      }
    }
    if (req.files && req.files.length > 0) {
      for (const [index, file] of req.files.entries()) {
        await ProductImage.create({
          product_id: product.id,
          image_url: `/uploads/products/${file.filename}`, // đường dẫn lưu ảnh
          is_main: index === 0 // ảnh đầu tiên là ảnh chính
        });
      }
    }

    res.status(201).json({
      message: "Product created successfully",
      product
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// ================== GET ALL PRODUCTS ==================
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      include: [
        {
          model: ProductAttributeValue,
          include: [ProductAttribute],
        },
        {
          model: ProductImage,
          as: "images",
          attributes: ["id", "image_url", "is_main", "created_at"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const formatted = products.map(p => ({
      ...p.toJSON(),
      mainImage: p.images?.find(img => img.is_main)?.image_url || null,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error getProducts:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================== GET PRODUCT BY ID ==================
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id, {
      include: [
        {
          model: ProductAttributeValue,
          include: [ProductAttribute],
        },
        {
          model: ProductImage,
          as: "images",
          attributes: ["id", "image_url", "is_main", "created_at"],
          required: false,
        },
      ],
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      ...product.toJSON(),
      images: product.images?.map(img => img.image_url) || [],
      mainImage: product.images?.find(img => img.is_main)?.image_url || null,
    });
  } catch (error) {
    console.error("Error getProductById:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Cập nhật sản phẩm
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // hoặc dùng storage tùy ý

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, brand_id, category_id, attributes } = req.body;

    // Parse attributes JSON nếu frontend gửi dạng string
    let parsedAttributes = [];
    try {
      parsedAttributes = typeof attributes === "string" ? JSON.parse(attributes) : attributes;
    } catch (err) {
      return res.status(400).json({ message: "Invalid JSON format in attributes" });
    }

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Update thông tin cơ bản
    await product.update({ name, description, price, stock, brand_id, category_id });

    // ✅ Cập nhật attributes (không dùng upsert)
    for (const attr of parsedAttributes) {
      const existing = await ProductAttributeValue.findOne({
        where: { product_id: product.id, attribute_id: attr.attribute_id },
      });

      if (existing) {
        // Update nếu đã tồn tại
        await existing.update({
          value_text: attr.value_text || null,
          value_number: attr.value_number || null,
          value_boolean: attr.value_boolean || null,
        });
      } else {
        // Tạo mới nếu chưa có
        await ProductAttributeValue.create({
          product_id: product.id,
          attribute_id: attr.attribute_id,
          value_text: attr.value_text || null,
          value_number: attr.value_number || null,
          value_boolean: attr.value_boolean || null,
        });
      }
    }

    // ✅ Cập nhật ảnh
    if (req.files && req.files.length > 0) {
      await ProductImage.destroy({ where: { product_id: product.id } });
      for (const [index, file] of req.files.entries()) {
        await ProductImage.create({
          product_id: product.id,
          image_url: `/uploads/products/${file.filename}`,
          is_main: index === 0,
        });
      }
    }

    res.json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// Xóa sản phẩm
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    await ProductAttributeValue.destroy({ where: { product_id: id } });
    await product.destroy();

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const products = await Product.findAll({
      where: { category_id: categoryId },
      include: [
        {
          model: ProductAttributeValue,
          include: [ProductAttribute]
        }
      ]
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /api/products/brand/:brandId
exports.getProductsByBrand = async (req, res) => {
  try {
    const { brandId } = req.params;
    const products = await Product.findAll({
      where: { brand_id: brandId },
      include: [
        {
          model: ProductAttributeValue,
          include: [ProductAttribute]
        }
      ]
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /api/products?category=1&brand=2&minPrice=100&maxPrice=500
exports.filterProducts = async (req, res) => {
  try {
    const { category, brand, minPrice, maxPrice } = req.query;
    const where = {};

    if (category) where.category_id = category;
    if (brand) where.brand_id = brand;
    if (minPrice && maxPrice) {
      where.price = { [Op.between]: [minPrice, maxPrice] };
    }

    const products = await Product.findAll({ where });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      order: [['created_at', 'DESC']],
      limit: 10
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.getNewArrivals = async (req, res) => {
  try {
    const products = await Product.findAll({
      order: [['created_at', 'DESC']],
      limit: 10,
      include: [
        {
          model: ProductAttributeValue,
          include: [ProductAttribute]
        }
      ]
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.searchProducts = async (req, res) => {
  try {
    let { q } = req.query;

    if (!q || q.trim() === "") {
      return res.json([]);
    }

    q = q.toLowerCase();

    // Tách từ khóa: "case ximatek rgb" -> ["case","ximatek","rgb"]
    const keywords = q.split(" ").filter(Boolean);

    const products = await Product.findAll({
      where: {
        [Op.and]: keywords.map((word) => ({
          name: { [Op.iLike]: `%${word}%` }
        }))
      },
      include: [
        {
          model: ProductAttributeValue,
          include: [ProductAttribute]
        }
      ]
    });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


