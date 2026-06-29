const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ElementModel = sequelize.define("ElementModel", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  parent_element_model_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  ship_model_id: DataTypes.INTEGER,
  ESWBS_code: {
    type: DataTypes.STRING(50),
    comment: "Codice sostitutivo contrattuale",
  },
  LCN_name: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  LCN_name_en: { type: DataTypes.STRING(255), allowNull: true },
  LCN_name_es: { type: DataTypes.STRING(255), allowNull: true },
  Supplier_ID: DataTypes.TEXT,
  Installed_quantity_on_End_Item: DataTypes.INTEGER,
  Manufacturer_ID: DataTypes.TEXT,
  Installed_Quantity_on_Ship: DataTypes.INTEGER,
  ContractualBreakdown_ID: DataTypes.INTEGER,
  LCNtype_ID: DataTypes.TEXT,
  Heat_transfer_to_air: {
    type: DataTypes.DECIMAL(10, 2),
    comment: "kW in aria",
  },
  Heat_transfer_to_water: {
    type: DataTypes.DECIMAL(10, 2),
    comment: "kW in acqua",
  },
  Power_supply: {
    type: DataTypes.STRING(50),
    comment: "es. 400VAC 60HZ 3F",
  },
  RatedPower: {
    type: DataTypes.DECIMAL(10, 2),
    comment: "Potenza nominale kW",
  },
  Shipyard_arrangement_drawing_link: DataTypes.TEXT,
  Position_on_arrangement_drawing: DataTypes.STRING(50),
  Reference_Designator: DataTypes.STRING(50),
  Shock_mounts_Vibration_mounts: DataTypes.TEXT,
  Ship_Area_Room_Code: DataTypes.STRING(50),
  ElementModel_installation_drawing_link: DataTypes.TEXT,
  Yearly_Operating_Hours: DataTypes.INTEGER,
  Yearly_Operating_Hours_during_missions: DataTypes.INTEGER,
  LCN_name_en: { type: DataTypes.STRING, allowNull: true },
  LCN_name_es: { type: DataTypes.STRING, allowNull: true },   
  Criticality_Code_CC: {
    type: DataTypes.TINYINT,
    comment: "1=NON CRITICO, 2=DEGRADATO, 3=MANCATO FUNZIONAMENTO",
  },
  Repairability_Code_CR: {
    type: DataTypes.TINYINT,
    comment: "1-4 livelli",
  },
  Replaceability_Code_CS: {
    type: DataTypes.TINYINT,
    comment: "1-4 livelli",
  },
  Alternate_LCN_ALC: DataTypes.STRING(10),
  Level1: DataTypes.STRING(10),
  Level3: DataTypes.STRING(10),
  Level4: DataTypes.STRING(10),
  Level5: DataTypes.STRING(10),
  Level6: DataTypes.STRING(10),
  Level7: DataTypes.STRING(10),
  Level8: DataTypes.STRING(10),
  Level9: DataTypes.STRING(10),
  XG_Center_of_gravity: {
    type: DataTypes.DECIMAL(10, 2),
    comment: "metri longitudinale",
  },
  YG_Center_of_gravity: {
    type: DataTypes.DECIMAL(10, 2),
    comment: "metri trasversale",
  },
  ZG_Center_of_gravity: {
    type: DataTypes.DECIMAL(10, 2),
    comment: "metri verticale",
  },
  Installed_quantity_on_next_higher_assy: DataTypes.INTEGER,
  Absorbed_current: {
    type: DataTypes.DECIMAL(10, 2),
    comment: "Ampere",
  },
  Revolution_speed: {
    type: DataTypes.INTEGER,
    comment: "giri/min",
  },
  Operating_pressure: {
    type: DataTypes.DECIMAL(10, 2),
    comment: "bar",
  },
  Mass_flow: {
    type: DataTypes.DECIMAL(10, 2),
    comment: "kg/s o l/s",
  },
  Delivery_Head: {
    type: DataTypes.DECIMAL(10, 2),
    comment: "m prevalenza",
  },
  Test_pressure: {
    type: DataTypes.DECIMAL(10, 2),
    comment: "bar",
  },
  Drawing_number: DataTypes.STRING(150),
  Drawing_number_revision_index: DataTypes.STRING(10),
  Drawing_title: DataTypes.TEXT,
  Dimensions_LxWxH: DataTypes.STRING(50),
  Weight: {
    type: DataTypes.DECIMAL(10, 2),
    comment: "kg",
  },
  Installation_Room_Name: DataTypes.STRING(100),
  Deck: DataTypes.STRING(20),
  Frame: DataTypes.STRING(20),
  Configuration_Item_Navy: DataTypes.STRING(50),
  IPL_Navy: DataTypes.STRING(50),
  eswbs_glossary_id: DataTypes.INTEGER,
  team_id: DataTypes.INTEGER,
  LCN: DataTypes.STRING(50),
  ALC: DataTypes.STRING(50),
  "CI/HDCI/CSCI": DataTypes.STRING(50),
  Production_testing_date: DataTypes.STRING(50),
  Installation_date: DataTypes.STRING(50),
  Part_ID: DataTypes.INTEGER,
}, {
  tableName: "ElementModel",
  timestamps: false,
  charset: "utf8mb4",
  collate: "utf8mb4_general_ci",
});

module.exports = ElementModel;
