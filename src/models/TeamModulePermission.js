// models/TeamModulePermission.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const TeamModulePermission = sequelize.define(
  "TeamModulePermission",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ship_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    module_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    can_read: {
      type: DataTypes.TINYINT(1),
      allowNull: false,
      defaultValue: 1,
    },
    can_write: {
      type: DataTypes.TINYINT(1),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "TeamModulePermission",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["team_id", "ship_id", "module_id"],
        name: "team_ship_module",
      },
    ],
  }
);

const Team = require("./team");
const AppModule = require("./AppModule");

TeamModulePermission.belongsTo(Team, { foreignKey: "team_id" });
Team.hasMany(TeamModulePermission, { foreignKey: "team_id" });

TeamModulePermission.belongsTo(AppModule, { foreignKey: "module_id" });
AppModule.hasMany(TeamModulePermission, { foreignKey: "module_id" });

module.exports = TeamModulePermission;