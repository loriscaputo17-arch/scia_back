// models/TeamShipAccess.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const TeamShipAccess = sequelize.define(
  "TeamShipAccess",
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
  },
  {
    tableName: "TeamShipAccess",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["team_id", "ship_id"],
        name: "team_ship",
      },
    ],
  }
);

const Team = require("./team");

TeamShipAccess.belongsTo(Team, { foreignKey: "team_id" });
Team.hasMany(TeamShipAccess, { foreignKey: "team_id" });

module.exports = TeamShipAccess;