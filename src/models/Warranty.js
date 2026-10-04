module.exports = (sequelize, DataTypes) => {
  const Warranty = sequelize.define("Warranty", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    product_id: { type: DataTypes.INTEGER },
    period_months: { type: DataTypes.INTEGER },
    conditions: { type: DataTypes.TEXT }
  }, {
    tableName: "warranties",
    timestamps: false
  });
  return Warranty;
};
