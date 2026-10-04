module.exports = (sequelize, DataTypes) => {
  const ImportDetail = sequelize.define("ImportDetail", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    receipt_id: { type: DataTypes.INTEGER },
    product_id: { type: DataTypes.INTEGER },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    unit_price: { type: DataTypes.DECIMAL(15, 2), allowNull: false }
  }, {
    tableName: "import_details",
    timestamps: false
  });
  return ImportDetail;
};
