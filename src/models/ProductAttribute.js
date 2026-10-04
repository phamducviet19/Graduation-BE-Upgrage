module.exports = (sequelize, DataTypes) => {
  const ProductAttribute = sequelize.define("ProductAttribute", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    category_id: { type: DataTypes.INTEGER },
    data_type: { type: DataTypes.ENUM("text", "number", "boolean"), allowNull: false },
    unit: { type: DataTypes.STRING(50) }
  }, {
    tableName: "product_attributes",
    timestamps: false
  });
  return ProductAttribute;
};
