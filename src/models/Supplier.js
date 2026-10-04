module.exports = (sequelize, DataTypes) => {
  const Supplier = sequelize.define("Supplier", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    address: { type: DataTypes.TEXT },
    phone: { type: DataTypes.STRING(20) },
    email: { type: DataTypes.STRING(255) }
  }, {
    tableName: "suppliers",
    timestamps: false
  });
  return Supplier;
};
