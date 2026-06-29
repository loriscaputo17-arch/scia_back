const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Spare = sequelize.define('Spare', {
  ID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  element_model_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  ship_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  Serial_number: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  Part_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  Parts_ID: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Va eliminato',
  },
  // The unitary price is stored as varchar(100) in EUR
  Unitary_price: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Prezzo unitario espresso in EUR',
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  quantity: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  warehouse: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  image: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  ean13: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  Dimensions_LxWxH: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  Price_reference_date: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Data di riferimento prezzo',
  },
  Weight: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Peso espresso in kg',
  },
  Volume: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Volume espresso in mm3 - dovrebbe servire alla valutazione dei volumi occupati dai ricambi',
  },
  NSN: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'NATO Stock Number',
  },
  Provisioning_Lead_Time_PLT: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Tempo in giorni necessario alla consegna deella parte da data emissione ordine',
  },
  Document_file_hyperlink: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Collegamento al datasheet/disegno della parte di ricambio',
  },
  Shelf_Life: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  Limited_Life: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'MAOT = Maximum Allowable Operating Time',
  },
  Limited_Life_Ens_Action_Code: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  Part_name_en: { type: DataTypes.STRING(255), allowNull: true },   
  Part_name_es: { type: DataTypes.STRING(255), allowNull: true }, 
}, {
  tableName: 'Spare',
  timestamps: false,
});

module.exports = Spare;