module.exports = (sequelize, DataTypes) => {
  const PcBuild = sequelize.define("PcBuild", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER },
    name: { type: DataTypes.STRING(255) },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: "pc_builds",
    timestamps: false
  });
  return PcBuild;
};
