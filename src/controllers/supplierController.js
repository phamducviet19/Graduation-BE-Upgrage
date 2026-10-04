const { Supplier } = require("../models");

// Lấy tất cả suppliers
exports.getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.findAll();
    res.json({
      message: "Suppliers fetched successfully",
      count: suppliers.length,
      data: suppliers
    });
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Lấy supplier theo id
exports.getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByPk(id);

    if (!supplier) {
      return res.status(404).json({ message: `Supplier with id ${id} not found` });
    }

    res.json(supplier);
  } catch (error) {
    console.error("Error fetching supplier:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Tạo mới supplier
exports.createSupplier = async (req, res) => {
  try {
    const { name, address, phone, email } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Supplier name is required" });
    }

    const supplier = await Supplier.create({ name, address, phone, email });

    res.status(201).json({
      message: "Supplier created successfully",
      created: supplier
    });
  } catch (error) {
    console.error("Error creating supplier:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Cập nhật supplier
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, email } = req.body;

    const supplier = await Supplier.findByPk(id);
    if (!supplier) {
      return res.status(404).json({ message: `Supplier with id ${id} not found` });
    }

    await supplier.update({
      name: name ?? supplier.name,
      address: address ?? supplier.address,
      phone: phone ?? supplier.phone,
      email: email ?? supplier.email
    });

    res.json({
      message: "Supplier updated successfully",
      updated: supplier
    });
  } catch (error) {
    console.error("Error updating supplier:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Xóa supplier
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByPk(id);

    if (!supplier) {
      return res.status(404).json({ message: `Supplier with id ${id} not found` });
    }

    await supplier.destroy();

    res.json({ message: `Supplier with id ${id} deleted successfully` });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
