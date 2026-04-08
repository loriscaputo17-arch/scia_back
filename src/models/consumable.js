const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Consumable = sequelize.define("Consumable", {
  ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  Commercial_Name: { type: DataTypes.STRING(100) },
  OrganizationCompanyNCAGE_ID: { type: DataTypes.INTEGER },
  Unit_of_measure: { type: DataTypes.STRING(100) },
  ConsumableType: { type: DataTypes.STRING(100) },
  File_link_Material_Safety_Datasheet: { type: DataTypes.STRING(100) },
  File_link_Technical_Datasheet: { type: DataTypes.STRING(100) },
  Dangerous_material: { type: DataTypes.STRING(100) },
  Commercial_package: { type: DataTypes.STRING(100) },
  ConsumableArticleCode: { type: DataTypes.STRING(100) },
  Consumable_quantity: { type: DataTypes.STRING(100) },
  Consumable_unit_of_measure: { type: DataTypes.STRING(100) },
  ICC_Item_Category_Code: { type: DataTypes.STRING(100) },
}, {
  tableName: "Consumables",
  timestamps: false,
});

module.exports = Consumable;