const { Op, fn, col, literal } = require("sequelize");
const { Order, OrderDetail, Product, Category, User } = require("../models");

// 🧮 1️⃣ Doanh thu theo thời gian
exports.getRevenueByDate = async (req, res) => {
  try {
    const revenue = await Order.findAll({
      attributes: [
        [fn("DATE", col("order_date")), "date"],
        [fn("SUM", col("total_amount")), "total_revenue"]
      ],
      group: [fn("DATE", col("order_date"))],
      order: [[fn("DATE", col("order_date")), "ASC"]]
    });

    res.json({ success: true, data: revenue });
  } catch (error) {
    console.error("Revenue error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 🏆 2️⃣ Sản phẩm bán chạy
exports.getTopProducts = async (req, res) => {
  try {
    const topProducts = await OrderDetail.findAll({
      attributes: [
        "product_id",
        [fn("SUM", col("quantity")), "total_sold"]
      ],
      include: [
        { model: Product, attributes: ["name", "price"] }
      ],
      group: ["product_id", "Product.id"],
      order: [[literal("total_sold"), "DESC"]],
      limit: 10
    });

    res.json({ success: true, data: topProducts });
  } catch (error) {
    console.error("Top products error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 📦 3️⃣ Số lượng đơn hàng theo trạng thái
exports.getOrderStatusCount = async (req, res) => {
  try {
    const result = await Order.findAll({
      attributes: [
        "status",
        [fn("COUNT", col("status")), "count"]
      ],
      group: ["status"]
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Order status error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 🧰 4️⃣ Thống kê theo danh mục sản phẩm
exports.getRevenueByCategory = async (req, res) => {
  try {
    const result = await OrderDetail.findAll({
      attributes: [
        [fn("SUM", literal("quantity * price")), "total_revenue"]
      ],
      include: [
        {
          model: Product,
          attributes: ["category_id"],
          include: [{ model: Category, attributes: ["name"] }]
        }
      ],
      group: ["Product->Category.id", "Product->Category.name"],
      order: [[literal("total_revenue"), "DESC"]]
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Revenue by category error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 💎 5️⃣ Khách hàng tiềm năng
exports.getTopCustomers = async (req, res) => {
  try {
    const result = await Order.findAll({
      attributes: [
        "user_id",
        [fn("SUM", col("total_amount")), "total_spent"]
      ],
      include: [
        { model: User, attributes: ["name", "email"] }
      ],
      group: ["user_id", "User.id", "User.name", "User.email"],
      order: [[literal("total_spent"), "DESC"]],
      limit: 10
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Top customers error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 📈 6️⃣ Tỷ lệ hoàn thành đơn hàng
exports.getOrderStatusPercentage = async (req, res) => {
  try {
    const totalOrders = await Order.count();
    const statuses = await Order.findAll({
      attributes: [
        "status",
        [fn("COUNT", col("status")), "count"]
      ],
      group: ["status"]
    });

    const result = statuses.map(s => ({
      status: s.status,
      percentage: ((s.dataValues.count / totalOrders) * 100).toFixed(2)
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Status percentage error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
