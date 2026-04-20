const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Maintenance_List = sequelize.define('Maintenance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },  
  id_ship: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Task description',
  },
  validity_from_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  }, 
  validity_to_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  System_ElementModel_ID: DataTypes.INTEGER,
  End_Item_ElementModel_ID: DataTypes.INTEGER,
  Maintenance_Item_ElementModel_ID: DataTypes.INTEGER,
  Operational_Not_operational: DataTypes.STRING(100),
  Maintenance_under_condition_description: DataTypes.TEXT('medium'),
  Mean_elapsed_time_MELAP: DataTypes.STRING(100),
  Note: DataTypes.STRING(100),
  Mean_Men_Hours_MMH: DataTypes.STRING(100),
  Personnel_no: DataTypes.INTEGER,
  Personnel_ID: DataTypes.INTEGER,
  RecurrencyType_ID: DataTypes.INTEGER,
  MaintenanceLevel_ID: DataTypes.INTEGER,
  Service_or_Maintenance_Manual_Link: DataTypes.STRING(100),
  Service_or_Maintenance_manual_ParagraphPage: {
    type: DataTypes.STRING(100),
    field: 'Service_or_Maintenance_manual_ParagraphPage'
  },
  Check_List: DataTypes.STRING(100),
  Maintenance_procedure_details: DataTypes.STRING(100),
  Reference_document: DataTypes.STRING(100),
  Maintenance_item_no: DataTypes.STRING(100),
  Item_no_on_Maintenance_Item: {
    type: DataTypes.STRING(100),
    field: 'Item_no_on_Maintenance_Item'
  },
  Reference_document_page: DataTypes.STRING(100),
  Maintenance_type_id: DataTypes.INTEGER,
}, {
  tableName: 'Maintenance',
  timestamps: false,
});

module.exports = Maintenance_List;
