module.exports = (sequelize, DataTypes) => {
  const ProductImage = sequelize.define("ProductImage", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    product_id: { type: DataTypes.INTEGER },
    image_url: { type: DataTypes.TEXT, allowNull: false },
    is_main: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: "product_images",
    timestamps: false
  });
  return ProductImage;
};

