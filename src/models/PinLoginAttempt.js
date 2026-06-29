const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const PinLoginAttempt = sequelize.define(
    "PinLoginAttempt",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ip: {
        type: DataTypes.STRING(45),
        allowNull: false,
        comment: "IPv4 (max 15) o IPv6 (max 45)",
      },
      ship_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      locked_until: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Timestamp fino al quale la coppia (ip, ship) è bloccata",
      },
      last_attempt_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "PinLoginAttempt",
      freezeTableName: true,
      timestamps: false, // last_attempt_at è gestito dal DB (ON UPDATE CURRENT_TIMESTAMP)
      indexes: [
        {
          name: "uniq_ip_ship",
          unique: true,
          fields: ["ip", "ship_id"],
        },
        {
          name: "idx_locked_until",
          fields: ["locked_until"],
        },
      ],
    }
  );

module.exports = PinLoginAttempt;