const { Cart, Product, ProductImage } = require('../models');

// Lấy giỏ hàng theo userId
exports.getCartByUserId = async (req, res) => {
  try {
    const userId = req.user.id;

    const cartItems = await Cart.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Product,
          include: [
            {
              model: ProductImage,
              as: "images",
              attributes: ["id", "image_url", "is_main", "created_at"],
              required: false
            }
          ]
        }
      ]
    });

    if (!cartItems || cartItems.length === 0) {
      return res.status(404).json({ message: 'Cart is empty' });
    }

    // xử lý ảnh
    const formatted = cartItems.map(item => {
      const data = item.toJSON();
      const prod = data.Product;

      if (prod) {
        const imgs = prod.images || [];
        prod.images = imgs.map(img => img.image_url);
        prod.mainImage = imgs.find(img => img.is_main)?.image_url || null;
      }

      return data;
    });

    res.json({
      message: 'Cart fetched successfully',
      cart: formatted
    });
  } catch (err) {
    console.error("Error getCartByUserId:", err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// Thêm sản phẩm vào giỏ hàng
exports.addProductToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ message: 'productId and quantity are required' });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Kiểm tra sản phẩm đã có trong giỏ chưa
    let cartItem = await Cart.findOne({ where: { user_id: userId, product_id: productId } });

    if (cartItem) {
      cartItem.quantity += quantity;
      await cartItem.save();
    } else {
      cartItem = await Cart.create({
        user_id: userId,
        product_id: productId,
        quantity
      });
    }

    res.status(201).json({
      message: 'Product added to cart successfully',
      cartItem
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Cập nhật số lượng sản phẩm trong giỏ hàng
exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;   // lấy productId từ params
    const { quantity } = req.body;      // số lượng mới

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Quantity must be greater than 0' });
    }

    // Tìm sản phẩm trong giỏ của user
    const cartItem = await Cart.findOne({
      where: { user_id: userId, product_id: productId }
    });

    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    // Cập nhật số lượng
    cartItem.quantity = quantity;
    await cartItem.save();

    res.json({
      message: 'Cart item updated successfully',
      cartItem
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// Xóa sản phẩm khỏi giỏ hàng
exports.removeProductFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    const cartItem = await Cart.findOne({ where: { user_id: userId, product_id: productId } });
    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    await cartItem.destroy();

    res.json({ message: 'Product removed from cart successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Xóa tất cả sản phẩm khỏi giỏ hàng
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    await Cart.destroy({ where: { user_id: userId } });

    res.json({ message: 'Cart cleared successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

