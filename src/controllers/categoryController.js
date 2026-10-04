const { Category } = require("../models");

exports.createCategory = async (req, res) => {
  try {
    let categories = req.body.categories || req.body;
    if (!Array.isArray(categories)) {
      categories = [categories];
    }
    if (!categories || categories.length === 0) {
      return res.status(400).json({ message: "Categories array is required" });
    }

    const results = [];

    for (const c of categories) {
      if (!c.name) continue; 
      const [category, created] = await Category.findOrCreate({
        where: { name: c.name },
        defaults: c 
      });
      results.push({
        category,
        created 
      });
    }
    res.status(201).json({
      message: "Categories processed",
      results
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      order: [['id', 'ASC']]
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCategoryById = async (req, res) => {
    try {
      const category = await Category.findByPk(req.params.id);
        if (!category) {
        return res.status(404).json({ message: "Category not found" });
        }
        res.json(category);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    const { name } = req.body;
    if (name) category.name = name;
    await category.save();
    res.json({ message: "Category updated", category });
  }
  catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    await category.destroy();
    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
