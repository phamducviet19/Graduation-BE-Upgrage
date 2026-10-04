const { Order, OrderDetail, Cart, Product, User, sequelize } = require("../models");

// Tạo đơn hàng từ giỏ hàng
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shipping_address, notes, payment_method } = req.body;

    // Tự động hủy và hoàn lại tồn kho cho các đơn hàng cũ đang 'Pending' của user (chưa thanh toán)
    const pendingOrders = await Order.findAll({
      where: { user_id: userId, status: "Pending" },
      include: [{ model: OrderDetail }]
    });

    for (const pendingOrder of pendingOrders) {
      if (pendingOrder.OrderDetails && pendingOrder.OrderDetails.length > 0) {
        for (const detail of pendingOrder.OrderDetails) {
          await Product.update(
            { stock: sequelize.literal(`stock + ${detail.quantity}`) },
            { where: { id: detail.product_id } }
          );
        }
      }
      await pendingOrder.update({ status: "Cancelled" });
    }

    // Lấy giỏ hàng của user
    const cartItems = await Cart.findAll({
      where: { user_id: userId },
      include: [{ model: Product }]
    });

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: "Giỏ hàng trống" });
    }

    // Tính tổng tiền & kiểm tra tồn kho
    let total_amount = 0;
    const orderDetails = [];

    for (const item of cartItems) {
      const product = item.Product;
      if (!product) {
        return res.status(404).json({ message: `Không tìm thấy sản phẩm ID ${item.product_id}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Sản phẩm ${product.name} chỉ còn ${product.stock} cái`
        });
      }

      total_amount += product.price * item.quantity;

      orderDetails.push({
        product_id: product.id,
        quantity: item.quantity,
        price: product.price
      });
    }

    // Tạo order
    const order = await Order.create({
      user_id: userId,
      total_amount,
      status: "Pending",
      shipping_address,
      notes
    });

    // Tạo order details
    for (const detail of orderDetails) {
      await OrderDetail.create({
        order_id: order.id,
        product_id: detail.product_id,
        quantity: detail.quantity,
        price: detail.price
      });

      // Trừ stock
      await Product.update(
        { stock: sequelize.literal(`stock - ${detail.quantity}`) },
        { where: { id: detail.product_id } }
      );
    }

    // Chỉ xoá giỏ hàng ngay nếu thanh toán bằng tiền mặt (COD)
    // Đối với thanh toán online (VNPAY,...), giỏ hàng sẽ được xoá khi cổng thanh toán xác nhận thành công
    const method = payment_method || req.body.paymentMethod;
    if (method && method.toUpperCase() === 'COD') {
      await Cart.destroy({ where: { user_id: userId } });
    }

    res.status(201).json({
      message: "Tạo đơn hàng thành công",
      order,
      details: orderDetails
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Lấy tất cả đơn hàng
exports.getAllOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const whereCondition = userRole === "admin" ? {} : { user_id: userId };

    const orders = await Order.findAll({
      where: whereCondition,
      include: [
        {
          model: OrderDetail,
          include: [{ model: Product, attributes: ["id", "name", "price"] }]
        },
        {
          model: User,
          attributes: ["id", "name", "email", "phone", "address"]
        }
      ],
      order: [["order_date", "DESC"]]
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error("Fetch orders error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update trạng thái đơn hàng
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["Pending", "Confirmed", "Shipped", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    // Lấy đơn hàng trước
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // Kiểm tra trạng thái hiện tại
    if (order.status === "Shipped") {
      return res.status(400).json({ message: "Đơn hàng đã giao, không thể thay đổi trạng thái" });
    }
    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Đơn hàng đã bị huỷ, không thể thay đổi trạng thái" });
    }

    // Nếu chuyển sang Cancelled thì hoàn lại tồn kho cho sản phẩm
    if (status === "Cancelled" && order.status !== "Cancelled") {
      const details = await OrderDetail.findAll({ where: { order_id: id } });
      for (const item of details) {
        await Product.update(
          { stock: sequelize.literal(`stock + ${item.quantity}`) },
          { where: { id: item.product_id } }
        );
      }
    }

    // Cập nhật trạng thái
    await order.update({ status });

    res.json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      data: order
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params; // order id
    const userRole = req.user.role;
    const userId = req.user.id;

    // Tìm order
    const order = await Order.findByPk(id, {
      include: [{ model: OrderDetail }]
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Nếu user thường thì chỉ được hủy đơn của chính mình
    if (userRole !== "admin" && order.user_id !== userId) {
      return res.status(403).json({ message: "Not allowed to cancel this order" });
    }

    // Chỉ cho phép hủy khi chưa ship
    if (order.status === "shipped") {
      return res.status(400).json({ message: "Cannot cancel shipped order" });
    }

    // Hoàn lại stock sản phẩm
    for (const item of order.OrderDetails) {
      const product = await Product.findByPk(item.product_id);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    // Cập nhật trạng thái
    order.status = "Cancelled";
    await order.save();

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (err) {
    console.error("Error cancelling order:", err);
    res.status(500).json({ message: "Server error while cancelling order" });
  }
};
