const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const OrganizationCompanyNCAGE_Entity = sequelize.define(
  "OrganizationCompanyNCAGE_Entity",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    entity_type: {
      type: DataTypes.ENUM("Shipyard", "Owner", "Supplier", "Producer"),
      allowNull: false,
    },

    created_at: {
      type: DataTypes.DATE, // DATETIME in MariaDB
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE, // DATETIME in MariaDB
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "OrganizationCompanyNCAGE_Entity",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = OrganizationCompanyNCAGE_Entity;
