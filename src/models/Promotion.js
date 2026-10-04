module.exports = (sequelize, DataTypes) => {
  const Promotion = sequelize.define("Promotion", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    discount: { type: DataTypes.DECIMAL(5, 2) },
    start_date: { type: DataTypes.DATE },
    end_date: { type: DataTypes.DATE }
  }, {
    tableName: "promotions",
    timestamps: false
  });
  return Promotion;
};
