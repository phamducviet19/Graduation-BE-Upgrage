const { ProductAttribute } = require("../models");

// Lấy danh sách attributes (có thể filter theo category_id)
exports.getAllAttributes = async (req, res) => {
  try {
    const { category_id } = req.query;
    const whereClause = category_id ? { category_id } : {};

    const attributes = await ProductAttribute.findAll({ where: whereClause });

    res.json({
      message: "Attributes fetched successfully",
      count: attributes.length,
      data: attributes
    });
  } catch (error) {
    console.error("Error fetching attributes:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Lấy 1 attribute theo id
exports.getAttributeById = async (req, res) => {
  try {
    const { id } = req.params;
    const attribute = await ProductAttribute.findByPk(id);

    if (!attribute) {
      return res.status(404).json({ message: `Attribute with id ${id} not found` });
    }

    res.json(attribute);
  } catch (error) {
    console.error("Error fetching attribute:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAttributesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId) {
      return res.status(400).json({ message: "Missing categoryId parameter" });
    }

    // Truy vấn các attribute theo category_id
    const attributes = await ProductAttribute.findAll({
      where: {
        category_id: categoryId,
        is_deleted: false
      },
      order: [['id', 'ASC']]
    });

    if (attributes.length === 0) {
      return res.status(404).json({ message: `No attributes found for category ID ${categoryId}` });
    }

    return res.status(200).json({
      message: "Attributes retrieved successfully",
      data: attributes
    });
  } catch (error) {
    console.error("Error fetching attributes by category:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Tạo mới attribute
exports.createAttributes = async (req, res) => {
  try {
    const attributes = req.body; // expecting an array

    if (!Array.isArray(attributes) || attributes.length === 0) {
      return res.status(400).json({ message: "An array of attributes is required" });
    }

    const createdAttrs = await ProductAttribute.bulkCreate(attributes);

    res.status(201).json({
      message: "Attributes created successfully",
      created: createdAttrs
    });
  } catch (error) {
    console.error("Error creating attributes:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Cập nhật attribute
exports.updateAttribute = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, data_type, unit } = req.body;

    const attribute = await ProductAttribute.findByPk(id);
    if (!attribute) {
      return res.status(404).json({ message: `Attribute with id ${id} not found` });
    }

    await attribute.update({
      name: name ?? attribute.name,
      category_id: category_id ?? attribute.category_id,
      data_type: data_type ?? attribute.data_type,
      unit: unit ?? attribute.unit
    });

    res.json({
      message: "Attribute updated successfully",
      updated: attribute
    });
  } catch (error) {
    console.error("Error updating attribute:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Xóa attribute
exports.deleteAttribute = async (req, res) => {
  try {
    const { id } = req.params;

    const attribute = await ProductAttribute.findByPk(id);
    if (!attribute) {
      return res.status(404).json({ message: `Attribute with id ${id} not found` });
    }

    await attribute.destroy();

    res.json({
      message: `Attribute with id ${id} deleted successfully`
    });
  } catch (error) {
    console.error("Error deleting attribute:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
