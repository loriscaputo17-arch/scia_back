const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const UserSettings = sequelize.define(
  "UserSettings",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    is_notifications_enabled_maintenance: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    maintenance_frequency: {
      type: DataTypes.ENUM("giornaliero", "settimanale", "mensile", "annuale"),
      defaultValue: "mensile",
    },

    is_notifications_enabled_checklist: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    checklist_frequency: {
      type: DataTypes.ENUM("giornaliero", "settimanale", "mensile", "annuale"),
      defaultValue: "mensile",
    },

    license: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    is_upcoming_maintenance_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_upcoming_checklist_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_upcoming_spare_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_planning_maintenance_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    planning_maintenance_frequency: {
      type: DataTypes.ENUM("giornaliero", "settimanale", "mensile"),
      defaultValue: false,
    },

    is_planning_checklist_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    planning_checklist_frequency: {
      type: DataTypes.ENUM("giornaliero", "settimanale", "mensile"),
      defaultValue: false,
    },

    is_planning_spare_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    planning_spare_frequency: {
      type: DataTypes.ENUM("giornaliero", "settimanale", "mensile"),
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "UserSettings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = UserSettings;
