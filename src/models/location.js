const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Location = sequelize.define("Location", {

    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      warehouse_id: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      location: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      ship_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
}, {
    tableName: "Location",
    timestamps: false
});


module.exports = Location;
  