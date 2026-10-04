module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define("Payment", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    order_id: { type: DataTypes.INTEGER },
    method: { type: DataTypes.STRING(50) },
    status: { type: DataTypes.ENUM("Pending", "Success", "Failed"), defaultValue: "Pending" },
    payment_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    amount: { type: DataTypes.DECIMAL(15, 2) }
  }, {
    tableName: "payments",
    timestamps: false
  });
  return Payment;
};
