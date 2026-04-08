const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Maintenance_ListSpare = sequelize.define("Maintenance_ListSpare", {
  ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  Maintenance_List_ID: { type: DataTypes.INTEGER },
  Spare_ID: { type: DataTypes.INTEGER },
  Spare_quantity: { type: DataTypes.INTEGER },
  Spare_unit_of_measure: { type: DataTypes.STRING(100) },
  ElementModel_ID: { type: DataTypes.INTEGER },
}, {
  tableName: "Maintenance_ListSpare",
  timestamps: false,
});

module.exports = Maintenance_ListSpare;