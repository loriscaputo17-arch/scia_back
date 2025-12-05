const sequelize = require("../config/db");

// Import modelli
const Job = require("./job");
const Element = require("./element");
const Ship = require("./ship");
const JobStatus = require("./jobStatus");
const JobExecution = require("./jobExecution");
const User = require("./User");
const UserLogin = require("./userLogin");
const UserRole = require("./userRole");
const UserSettings = require("./userSettings");
const Team = require("./team");
const Spare = require("./spare");
const RanksMarine = require("./RanksMarine");
const Task = require("./task");
const recurrencyType = require("./recurrencyType");
const Facilities = require("./facilities");
const Cart = require("./cart");
const Location = require("./location");
const Warehouses = require("./warehouses");
const ShipFiles = require("./shipFile2");
const Readings = require("./Reading");
const ReadingsType = require("./ReadingsType");
const Scans = require("./scan");
const Failures = require("./failure");
const PhotographicNote = require("./photographicNote");
const VocalNote = require("./VocalNote");
const TextNote = require("./TextNote");
const MaintenanceType = require("./maintenanceType");
const ElemetModel = require("./elementModel");
const maintenanceLevel = require("./maintenanceLevel");
const Maintenance_List = require("./maintenanceList");
const StatusCommentsMaintenance = require("./StatusCommentsMaintenance");
const maintenanceListSpareAdded = require("./maintenanceListSpareAdded");
const Parts = require("./Parts");
const OrganizationCompanyNCAGE = require("./OrganizationCompanyNCAGE");
const TeamMember = require("./teamMember");
const ProjectCommission = require("./projectCommission");
const Shipyards = require("./shipyard");
const shipModel = require("./shipModel");
const Owner = require("./owner");
const ESWBS_Glossary = require("./ESWBS_Glossary");
const MaintenanceGroup = require("./maintenanceGroup");
const Threshold = require("./Threshold");

/* -------------------------- RELAZIONI OWNER / SHIPYARD -------------------------- */
Owner.belongsTo(OrganizationCompanyNCAGE, {
  foreignKey: "OrganizationCompanyNCAGE_ID",
  as: "organizationCompany",
});
OrganizationCompanyNCAGE.hasMany(Owner, {
  foreignKey: "OrganizationCompanyNCAGE_ID",
  as: "owners",
});

Shipyards.belongsTo(OrganizationCompanyNCAGE, {
  foreignKey: "OrganizationCompanyNCAGE_ID",
  as: "organizationCompanyNCAGE",
});
OrganizationCompanyNCAGE.hasMany(Shipyards, {
  foreignKey: "OrganizationCompanyNCAGE_ID",
  as: "shipyards",
});


/* -------------------------- RELAZIONI USER / TEAM -------------------------- */
User.belongsTo(Team, { as: "userTeam", foreignKey: "team_id" });
Team.hasMany(User, { as: "teamMembers", foreignKey: "team_id" });

// 🔹 Un utente può essere leader di un team
Team.belongsTo(User, { as: "leader", foreignKey: "team_leader_id" });
User.hasOne(Team, { as: "managedTeam", foreignKey: "team_leader_id" });

// 🔹 Un team è assegnato a una nave
Team.belongsTo(Ship, { foreignKey: "ship_id", as: "ship" });
Ship.hasMany(Team, { foreignKey: "ship_id", as: "shipTeams" });

/* -------------------------- RELAZIONI USER LOGIN / ROLE / SETTINGS -------------------------- */
User.hasOne(UserLogin, { foreignKey: "user_id", as: "login" });
UserLogin.belongsTo(User, { foreignKey: "user_id", as: "loginUser" });

User.hasOne(UserRole, { foreignKey: "user_id", as: "role" });
UserRole.belongsTo(User, { foreignKey: "user_id", as: "roleUser" });

User.hasOne(UserSettings, { foreignKey: "user_id", as: "settings" });
UserSettings.belongsTo(User, { foreignKey: "user_id", as: "settingsUser" });

/* -------------------------- RELAZIONI TEAM MEMBER -------------------------- */
// 🔹 Relazione solo User ↔ Team (niente Ship)
User.hasMany(TeamMember, { foreignKey: "user_id", as: "userTeamMembers" });
Team.hasMany(TeamMember, { foreignKey: "team_id", as: "teamTeamMembers" });
TeamMember.belongsTo(User, { foreignKey: "user_id", as: "user" });
TeamMember.belongsTo(Team, { foreignKey: "team_id", as: "team" });

/* -------------------------- RELAZIONI JOB / ELEMENT / SHIP -------------------------- */
Element.belongsTo(Ship, { foreignKey: "ship_id", as: "ship" });
Ship.hasMany(Element, { foreignKey: "ship_id", as: "elements" });

Element.hasMany(JobExecution, { foreignKey: "element_eswbs_instance_id" });
JobExecution.belongsTo(Element, { foreignKey: "element_eswbs_instance_id" });

JobStatus.hasMany(JobExecution, { foreignKey: "status_id", as: "jobs" });
JobExecution.belongsTo(JobStatus, { foreignKey: "status_id", as: "status" });

/* -------------------------- RELAZIONI MAINTENANCE -------------------------- */
JobExecution.belongsTo(Maintenance_List, {
  foreignKey: "job_id",
  as: "maintenance_list",
});
Maintenance_List.hasMany(JobExecution, {
  foreignKey: "job_id",
  as: "executions",
});

Cart.belongsTo(Spare, { foreignKey: "spare_id", as: "spare" });
Spare.hasMany(Cart, { foreignKey: "spare_id", as: "cartItems" });

Maintenance_List.belongsTo(ElemetModel, {
  foreignKey: "System_ElementModel_ID",
  as: "system_element_model",
});

Maintenance_List.belongsTo(ElemetModel, {
  foreignKey: "End_Item_ElementModel_ID",
  as: "end_item_element_model",
});

Maintenance_List.belongsTo(ElemetModel, {
  foreignKey: "Maintenance_Item_ElementModel_ID",
  as: "maintenance_item_element_model",
});

Maintenance_List.belongsTo(maintenanceLevel, {
  foreignKey: "MaintenanceLevel_ID",
  as: "maintenance_level",
});

Maintenance_List.belongsTo(MaintenanceType, {
  foreignKey: "Maintenance_type_id",
  as: "maintenance_type",
});
Maintenance_List.belongsTo(recurrencyType, {
  foreignKey: "RecurrencyType_ID",
  as: "recurrency_type",
});
Maintenance_List.belongsTo(ElemetModel, {
  foreignKey: "System_ElementModel_ID",
  as: "element_model",
});

Element.belongsTo(ElemetModel, {
  foreignKey: "element_model_id",
  as: "element_model",
});

ElemetModel.hasMany(Element, {
  foreignKey: "element_model_id",
  as: "elements",
});

Location.belongsTo(Warehouses, {
  foreignKey: "warehouse_id",
  as: "warehouseInfo",
});

Warehouses.hasMany(Location, {
  foreignKey: "warehouse_id",
  as: "locations",
});

/* -------------------------- RELAZIONI NOTE ↔ JOB EXECUTION -------------------------- */
JobExecution.hasMany(VocalNote, { foreignKey: "task_id", as: "vocalNotes" });
VocalNote.belongsTo(JobExecution, { foreignKey: "task_id", as: "jobExecution" });

JobExecution.hasMany(TextNote, { foreignKey: "task_id", as: "textNotes" });
TextNote.belongsTo(JobExecution, { foreignKey: "task_id", as: "jobExecution" });

JobExecution.hasMany(PhotographicNote, { foreignKey: "task_id", as: "photographicNotes" });
PhotographicNote.belongsTo(JobExecution, { foreignKey: "task_id", as: "jobExecution" });

JobExecution.belongsTo(recurrencyType, { foreignKey: "recurrency_type_id", as: "recurrency_type" });
recurrencyType.hasMany(JobExecution, { foreignKey: "recurrency_type_id", as: "job_executions" });

/* -------------------------- RELAZIONI SCANS / NOTES -------------------------- */
Scans.belongsTo(Ship, { foreignKey: "ship_id", as: "ship" });
Ship.hasMany(Scans, { foreignKey: "ship_id", as: "scans" });

Scans.belongsTo(Element, { foreignKey: "element_id", as: "element" });
Element.hasMany(Scans, { foreignKey: "element_id", as: "scans" });

PhotographicNote.belongsTo(User, { foreignKey: "author", as: "authorDetails" });
User.hasMany(PhotographicNote, { foreignKey: "author", as: "photoNotes" });

VocalNote.belongsTo(User, { foreignKey: "author", as: "authorDetails" });
User.hasMany(VocalNote, { foreignKey: "author", as: "vocalNotes" });

TextNote.belongsTo(User, { foreignKey: "author", as: "authorDetails" });
User.hasMany(TextNote, { foreignKey: "author", as: "textNotes" });

/* -------------------------- RELAZIONI PROJECT COMMISSION -------------------------- */
ProjectCommission.belongsTo(Shipyards, {
  foreignKey: "shipyard_builder_id",
  as: "shipyard",
});
Shipyards.hasMany(ProjectCommission, {
  foreignKey: "shipyard_builder_id",
  as: "projects",
});

ProjectCommission.hasMany(Ship, { foreignKey: "project_id", as: "ships" });
Ship.belongsTo(ProjectCommission, { foreignKey: "project_id", as: "project" });

/* -------------------------- RELAZIONI PARTS / SPARE -------------------------- */
Spare.belongsTo(Parts, { foreignKey: "Parts_ID", as: "part" });
Parts.hasMany(Spare, { foreignKey: "Parts_ID", as: "spares" });

Parts.belongsTo(OrganizationCompanyNCAGE, {
  foreignKey: "OrganizationCompanyNCAGE_ID",
  as: "organizationCompanyNCAGE",
});
OrganizationCompanyNCAGE.hasMany(Parts, {
  foreignKey: "OrganizationCompanyNCAGE_ID",
  as: "parts",
});

Readings.belongsTo(ReadingsType, { foreignKey: "reading_type_id", as: "type" });
ReadingsType.hasMany(Readings, { foreignKey: "reading_type_id", as: "readings" });

Readings.belongsTo(Element, { foreignKey: "element_id", as: "element" });
Element.hasMany(Readings, { foreignKey: "element_id", as: "readings" });

Spare.belongsTo(ElemetModel, { foreignKey: "element_model_id", as: "elementModel" });
ElemetModel.hasMany(Spare, { foreignKey: "element_model_id", as: "spares" });

Failures.belongsTo(User, {
  foreignKey: "userExecution",
  targetKey: "id",
  as: "userExecutionData",
  constraints: false,
});

User.hasMany(Failures, {
  foreignKey: "userExecution",
  sourceKey: "id",
  as: "failuresByExecution",
  constraints: false,
});

/* -------------------------- RELAZIONI FINALI -------------------------- */
const db = {
  sequelize,
  Job,
  Element,
  Ship,
  JobStatus,
  JobExecution,
  User,
  UserLogin,
  UserRole,
  UserSettings,
  Team,
  Spare,
  RanksMarine,
  Task,
  recurrencyType,
  Facilities,
  Cart,
  Location,
  Warehouses,
  ShipFiles,
  Readings,
  ReadingsType,
  Scans,
  Failures,
  PhotographicNote,
  VocalNote,
  TextNote,
  MaintenanceType,
  ElemetModel,
  maintenanceLevel,
  Maintenance_List,
  StatusCommentsMaintenance,
  maintenanceListSpareAdded,
  Parts,
  OrganizationCompanyNCAGE,
  TeamMember,
  ProjectCommission,
  Shipyards,
  shipModel,
  Owner,
  ESWBS_Glossary,
  MaintenanceGroup,
  Threshold
};

module.exports = db;
