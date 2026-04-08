const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Tool = sequelize.define("Tool", {
  ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  element_model_id: { type: DataTypes.INTEGER },
  ship_id: { type: DataTypes.INTEGER },
  Tool_name: { type: DataTypes.STRING(255), allowNull: false },
  Serial_number: { type: DataTypes.STRING(255) },
  Original_description_OEM: { type: DataTypes.STRING(100) },
  Part_Number_OEM: { type: DataTypes.STRING(100) },
  OrganizationCompanyNCAGE_ID: { type: DataTypes.INTEGER },
  location: { type: DataTypes.STRING(100) },
  quantity: { type: DataTypes.STRING(100) },
  warehouse: { type: DataTypes.INTEGER },
  user_id: { type: DataTypes.INTEGER },
  image: { type: DataTypes.STRING(200) },
  NSN: { type: DataTypes.STRING(100) },
  Provisioning_Lead_Time_PLT: { type: DataTypes.INTEGER },
}, {
  tableName: "Tools",
  timestamps: false,
});

module.exports = Tool;