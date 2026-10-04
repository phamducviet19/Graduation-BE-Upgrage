module.exports = (sequelize, DataTypes) => {
  const PcBuildDetail = sequelize.define("PcBuildDetail", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    build_id: { type: DataTypes.INTEGER },
    product_id: { type: DataTypes.INTEGER }
  }, {
    tableName: "pc_build_details",
    timestamps: false
  });
  return PcBuildDetail;
};
