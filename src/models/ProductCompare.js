module.exports = (sequelize, DataTypes) => {
  const ProductCompare = sequelize.define("ProductCompare", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER },
    product_id: { type: DataTypes.INTEGER },
    category_id: { type: DataTypes.INTEGER },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: "product_compare",
    timestamps: false
  });
  return ProductCompare;
};
