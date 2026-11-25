const { User } = require("../models");

// Lấy danh sách khách hàng (role = client)
exports.getAllClients = async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : null;
    const limit = req.query.limit ? parseInt(req.query.limit) : null;

    if (page || limit) {
      const currentPage = Math.max(1, page || 1);
      const currentLimit = Math.max(1, limit || 10);
      const offset = (currentPage - 1) * currentLimit;

      const { count, rows: clients } = await User.findAndCountAll({
        where: { role: "client" },
        attributes: ["id", "name", "email", "phone", "address", "created_at"],
        order: [["created_at", "DESC"]],
        limit: currentLimit,
        offset,
      });

      return res.json({
        message: "Clients fetched successfully",
        count,
        data: clients,
        pagination: {
          totalItems: count,
          totalPages: Math.ceil(count / currentLimit),
          currentPage: currentPage,
          pageSize: currentLimit
        }
      });
    }

    const clients = await User.findAll({
      where: { role: "client" },
      attributes: ["id", "name", "email", "phone", "address", "created_at"]
    });

    res.json({
      message: "Clients fetched successfully",
      count: clients.length,
      data: clients
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Lấy thông tin 1 khách hàng theo id (chỉ client)
exports.getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await User.findOne({
      where: { id, role: "client" },
      attributes: ["id", "name", "email", "phone", "address", "created_at"]
    });

    if (!client) {
      return res.status(404).json({ message: `Client with id ${id} not found` });
    }

    res.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Xóa khách hàng (chỉ client)
exports.deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await User.findOne({ where: { id, role: "client" } });

    if (!client) {
      return res.status(404).json({ message: `Client with id ${id} not found` });
    }

    await client.destroy();

    res.json({ message: `Client with id ${id} deleted successfully` });
  } catch (error) {
    console.error("Error deleting client:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
