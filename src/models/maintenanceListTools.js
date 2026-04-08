const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Maintenance_ListTools = sequelize.define("Maintenance_ListTools", {
  ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  Maintenance_List_ID: { type: DataTypes.INTEGER },
  Tool_ID: { type: DataTypes.INTEGER, field: "Tool ID" },
  Tool_quantity: { type: DataTypes.STRING(100) },
  Tool_Quantity_Unit_of_measure: { type: DataTypes.STRING(100) },
}, {
  tableName: "Maintenance_ListTools",
  timestamps: false,
});

module.exports = Maintenance_ListTools;