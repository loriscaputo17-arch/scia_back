const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Failures = sequelize.define('Failures', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  gravity: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  executionUserType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userExecution: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  element_id: { type: DataTypes.INTEGER, allowNull: true },
  eswbs_code: { type: DataTypes.STRING(50), allowNull: true },
  component_name: { type: DataTypes.STRING(255), allowNull: true },
  partNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customFields: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ship_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: "Failures",
  timestamps: false
});

module.exports = Failures;
  