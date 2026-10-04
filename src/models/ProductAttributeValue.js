module.exports = (sequelize, DataTypes) => {
  const ProductAttributeValue = sequelize.define("ProductAttributeValue", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    product_id: { type: DataTypes.INTEGER },
    attribute_id: { type: DataTypes.INTEGER },
    value_text: { type: DataTypes.TEXT },
    value_number: { type: DataTypes.DECIMAL(20, 6) },
    value_boolean: { type: DataTypes.BOOLEAN }
  }, {
    tableName: "product_attribute_values",
    timestamps: false
  });
  return ProductAttributeValue;
};
