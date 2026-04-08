const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Maintenance_ListConsumable = sequelize.define("Maintenance_ListConsumable", {
  ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  Maintenance_List_ID: { type: DataTypes.INTEGER },
  Consumable_ID: { type: DataTypes.INTEGER },
  Consumable_quantity: { type: DataTypes.DOUBLE },
  Consumable_quantity_Unit_of_measure: { type: DataTypes.STRING(100) },
}, {
  tableName: "Maintenance_ListConsumable",
  timestamps: false,
});

module.exports = Maintenance_ListConsumable;