const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Reading = sequelize.define("Readings", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  ship_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  task_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  task_name_en: {                    
    type: DataTypes.STRING,
    allowNull: true,
  },
  task_name_es: {                   
    type: DataTypes.STRING,
    allowNull: true,
  },
  eswbs_id: {
    type: DataTypes.STRING,
  },
  recurrence: {
    type: DataTypes.STRING,
  },
  value: {
    type: DataTypes.STRING,
  },
  unit: {
    type: DataTypes.STRING,
  },
  due_date: {
    type: DataTypes.DATE,
  },
  description: {
    type: DataTypes.TEXT,
  },
  tags: {
    type: DataTypes.STRING,
  },
  team: {
    type: DataTypes.STRING,
  },
}, {
  tableName: "Readings",
  timestamps: false,
});

module.exports = Reading;