module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define("Product", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    price: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    stock: { type: DataTypes.INTEGER, allowNull: false },
    brand_id: { type: DataTypes.INTEGER },
    category_id: { type: DataTypes.INTEGER },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: "products",
    timestamps: false
  });
  return Product;
};
