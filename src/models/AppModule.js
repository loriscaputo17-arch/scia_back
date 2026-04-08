// models/AppModule.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const AppModule = sequelize.define(
  "AppModule",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    tableName: "AppModule",
    timestamps: false,
  }
);

module.exports = AppModule;