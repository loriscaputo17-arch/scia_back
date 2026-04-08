const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ShipFile = sequelize.define("ShipFiles", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    ship_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    file_link: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    file_name: {
        type: DataTypes.STRING,
    },
    file_type: {
        type: DataTypes.STRING,
    },
    uploaded_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    description: {
        type: DataTypes.TEXT,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    // ── Nuovi campi Drive ──────────────────────────────
    drive_file_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: "ID del file su Google Drive",
    },
    drive_folder_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: "ID della cartella padre su Google Drive",
    },
    parent_folder_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "FK self-referenziale per gerarchia cartelle nel DB",
    },
    is_folder: {
        type: DataTypes.TINYINT,
        defaultValue: 0,
        comment: "1 = cartella, 0 = file",
    },
    element_model_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "FK verso ElementModel per filtrare per impianto",
    },
}, {
    tableName: "ShipFiles",
    timestamps: false,
});

module.exports = ShipFile;