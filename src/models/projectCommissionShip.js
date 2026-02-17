const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ProjectCommissionShip = sequelize.define('ProjectCommissionShip', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  expected_delivery: DataTypes.DATE,
  effective_delivery: DataTypes.DATE,
  ship_id: DataTypes.INTEGER,
  project_commission_id: DataTypes.INTEGER
}, {
  tableName: "ProjectCommissionShip",
  timestamps: false
});

module.exports = ProjectCommissionShip;

