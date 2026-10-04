module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define("Order", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER },
    order_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.ENUM("Pending", "Confirmed", "Shipped", "Cancelled"), defaultValue: "Pending" },
    total_amount: { type: DataTypes.DECIMAL(15, 2) },
    shipping_address: { type: DataTypes.TEXT },
    notes: { type: DataTypes.TEXT }
  }, {
    tableName: "orders",
    timestamps: false
  });
  return Order;
};
