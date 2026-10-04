module.exports = (sequelize, DataTypes) => {
  const Cart = sequelize.define("Cart", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER },
    product_id: { type: DataTypes.INTEGER },
    quantity: { type: DataTypes.INTEGER, allowNull: false }
  }, {
    tableName: "cart",
    timestamps: false
  });
  return Cart;
};
