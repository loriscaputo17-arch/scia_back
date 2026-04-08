// models/TeamElementAccess.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const TeamElementAccess = sequelize.define(
  "TeamElementAccess",
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
    element_model_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "TeamElementAccess",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["team_id", "ship_id", "element_model_id"],
        name: "team_ship_element",
      },
    ],
  }
);

const Team = require("./team");
const ElementModel = require("./elementModel");

TeamElementAccess.belongsTo(Team, { foreignKey: "team_id" });
Team.hasMany(TeamElementAccess, { foreignKey: "team_id" });

TeamElementAccess.belongsTo(ElementModel, { foreignKey: "element_model_id" });
ElementModel.hasMany(TeamElementAccess, { foreignKey: "element_model_id" });

module.exports = TeamElementAccess;