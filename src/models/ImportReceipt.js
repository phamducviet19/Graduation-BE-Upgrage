module.exports = (sequelize, DataTypes) => {
  const ImportReceipt = sequelize.define("ImportReceipt", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    supplier_id: { type: DataTypes.INTEGER },
    import_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    total_amount: { type: DataTypes.DECIMAL(15, 2) }
  }, {
    tableName: "import_receipts",
    timestamps: false
  });
  return ImportReceipt;
};
