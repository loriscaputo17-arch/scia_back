const {
  JobExecution,
  Maintenance_List,
  recurrencyType,
  maintenanceLevel,
  ElemetModel,
  Element,
  Spare,
  Readings,
  ReadingsType,
  Parts,
  OrganizationCompanyNCAGE,
  Failures,
  ShipFiles
} = require("../models");

const { Op } = require("sequelize");

exports.getSummary = async (req, res) => {
  try {
    const { ship_id, user_id } = req.query;

    if (!ship_id || !user_id) {
      return res.status(400).json({ error: "Missing ship_id or user_id" });
    }

    // ==================================================
    // 1️⃣ COUNTERS
    // ==================================================

    const [
      maintenanceCount,
      checklistCount,
      readingsCount,
      sparesCount,
      failuresCount,
      filesCount
    ] = await Promise.all([
      JobExecution.count({ where: { ship_id } }),

      JobExecution.count({
        where: { ship_id },
        include: [
          {
            model: Maintenance_List,
            as: "maintenance_list",
            required: true,
            where: { Check_List: "1" }
          }
        ]
      }),

      Readings.count({ where: { ship_id } }),
      Spare.count({ where: { ship_id } }),
      Failures.count({ where: { ship_id } }),
      ShipFiles.count({ where: { ship_id, user_id } })
    ]);

    // ==================================================
    // 2️⃣ ULTIMI 2 RECORD PER OGNI CATEGORIA
    // ==================================================

    const [
      lastMaintenance,
      lastChecklist,
      lastReadings,
      lastSpares,
      lastFailures,
      lastFiles
    ] = await Promise.all([

      // ---- ULTIME 2 MANUTENZIONI ----
      JobExecution.findAll({
        where: { ship_id },
        limit: 2,
        order: [["starting_date", "DESC"]],
        include: [
          {
            model: Maintenance_List,
            as: "maintenance_list",
            include: [
              { model: maintenanceLevel, as: "maintenance_level" },
              { model: recurrencyType, as: "recurrency_type" },
              { model: ElemetModel, as: "system_element_model" },
              { model: ElemetModel, as: "end_item_element_model" },
              { model: ElemetModel, as: "maintenance_item_element_model" }
            ]
          },
          {
            model: Element,
            as: "Element",
            include: [
              { model: ElemetModel, as: "element_model" }
            ]
          }
        ]
      }),

      // ---- ULTIME 2 CHECKLIST ----
      JobExecution.findAll({
        where: { ship_id },
        limit: 2,
        order: [["starting_date", "DESC"]],
        include: [
          {
            model: Maintenance_List,
            as: "maintenance_list",
            required: true,
            where: { Check_List: "1" }
          }
        ]
      }),

      // ---- ULTIMI 2 READINGS ----
      Readings.findAll({
        where: { ship_id },
        limit: 2,
        include: [
          { model: ReadingsType, as: "type" },
          {
            model: Element,
            as: "element",
            include: [
              { model: ElemetModel, as: "element_model" }
            ]
          }
        ]
      }),

      // ---- ULTIMI 2 SPARE PARTS ----
      Spare.findAll({
        where: { ship_id },
        limit: 2,
        include: [
          { model: ElemetModel, as: "elementModel" },
          {
            model: Parts,
            as: "part",
            include: [
              { model: OrganizationCompanyNCAGE, as: "organizationCompanyNCAGE" }
            ]
          }
        ]
      }),

      // ---- ULTIME 2 FAILURES ----
      Failures.findAll({
        where: { ship_id },
        limit: 2,
      }),

      // ---- ULTIMI 2 FILES ----
      ShipFiles.findAll({
        where: { ship_id, user_id },
        limit: 2,
        order: [["uploaded_at", "DESC"]]
      })
    ]);

    // ==================================================
    // 3️⃣ RESPONSE
    // ==================================================
    res.status(200).json({
      counters: {
        maintenance: maintenanceCount,
        checklist: checklistCount,
        readings: readingsCount,
        spares: sparesCount,
        failures: failuresCount,
        files: filesCount
      },
      last: {
        maintenance: lastMaintenance,
        checklist: lastChecklist,
        readings: lastReadings,
        spares: lastSpares,
        failures: lastFailures,
        files: lastFiles
      }
    });

  } catch (error) {
    console.error("Error in dashboard summary:", error);
    res.status(500).json({ error: "Error retrieving dashboard summary" });
  }
};
