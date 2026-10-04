const { ImportReceipt, ImportDetail, Supplier, Product } = require("../models");

// Tạo phiếu nhập kèm chi tiết và cập nhật stock sản phẩm
exports.createImport = async (req, res) => {
  const { supplier_id, details } = req.body;
  // details = [{ product_id, quantity, unit_price }, ...]

  try {
    if (!supplier_id || !details || details.length === 0) {
      return res.status(400).json({ message: "Invalid input" });
    }

    // Tính tổng tiền
    const total_amount = details.reduce((sum, item) => {
      return sum + item.quantity * item.unit_price;
    }, 0);

    // Tạo phiếu nhập
    const receipt = await ImportReceipt.create({
      supplier_id,
      total_amount,
    });

    // Chuẩn bị mảng detailRecords
    const detailRecords = [];

    for (const d of details) {
      detailRecords.push({
        receipt_id: receipt.id,
        product_id: d.product_id,
        quantity: d.quantity,
        unit_price: d.unit_price,
      });

      // Cập nhật stock cho product
      const product = await Product.findByPk(d.product_id);
      if (!product) {
        return res.status(404).json({ message: `Product ${d.product_id} not found` });
      }

      product.stock += d.quantity;
      await product.save();
    }

    // Lưu chi tiết nhập hàng
    await ImportDetail.bulkCreate(detailRecords);

    res.status(201).json({
      message: "Import receipt created successfully",
      receipt,
      details: detailRecords,
    });
  } catch (error) {
    console.error("Create import error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Lấy danh sách phiếu nhập
exports.getAllImports = async (req, res) => {
  try {
    const receipts = await ImportReceipt.findAll({
      include: [
        { model: Supplier, attributes: ["id", "name"] },
        {
          model: ImportDetail,
          include: [{ model: Product, attributes: ["id", "name"] }],
        },
      ],
      order: [["import_date", "DESC"]],
    });
    res.json(receipts);
  } catch (error) {
    console.error("Get imports error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Lấy chi tiết 1 phiếu nhập
exports.getImportById = async (req, res) => {
  try {
    const { id } = req.params;
    const receipt = await ImportReceipt.findByPk(id, {
      include: [
        { model: Supplier, attributes: ["id", "name"] },
        {
          model: ImportDetail,
          include: [{ model: Product, attributes: ["id", "name"] }],
        },
      ],
    });

    if (!receipt) {
      return res.status(404).json({ message: "Import receipt not found" });
    }
    res.json(receipt);
  } catch (error) {
    console.error("Get import error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Xóa phiếu nhập
exports.deleteImport = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ImportReceipt.destroy({ where: { id } });

    if (!deleted) {
      return res.status(404).json({ message: "Import receipt not found" });
    }
    res.json({ message: "Import receipt deleted successfully" });
  } catch (error) {
    console.error("Delete import error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
