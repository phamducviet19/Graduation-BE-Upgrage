const { Brand } = require("../models");

exports.createBrand = async (req, res) => {
  try {
    let brands = req.body.brands || req.body;
    if (!Array.isArray(brands)) {
      brands = [brands];
    }
    if (!brands || brands.length === 0) {
      return res.status(400).json({ message: "Brands array is required" });
    }
    const results = [];
    for (const b of brands) {
      if (!b.name) continue; 
      const [brand, created] = await Brand.findOrCreate({
        where: { name: b.name },
        defaults: b
      });
      results.push({
        brand,
        created 
      });
    }
    res.status(201).json({
      message: "Brands processed",
      results
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.findAll({
      order: [['id', 'ASC']]
    });
    res.json(brands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBrandById = async (req, res) => {
    try {
      const brand = await Brand.findByPk(req.params.id);
      if (!brand) {
        return res.status(404).json({ message: "Brand not found" });
      }
      res.json(brand);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
};

exports.updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findByPk(req.params.id);
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }
    const { name } = req.body;
    if (name) brand.name = name;
    await brand.save();
    res.json({ message: "Brand updated", brand });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findByPk(req.params.id);
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }
    await brand.destroy();
    res.json({ message: "Brand deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};