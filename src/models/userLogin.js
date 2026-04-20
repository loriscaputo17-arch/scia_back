const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); // Importa l'istanza Sequelize
const User = require("./User"); // Importa il modello User

const UserLogin = sequelize.define(
  "UserLogin",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    pin: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    pin_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    biometric_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, 
  {
    tableName: "UserLogin",
    timestamps: false,
  }
);

// Associazione tra UserLogin e User
UserLogin.belongsTo(User, { foreignKey: "user_id", as: "user" });

module.exports = UserLogin;
