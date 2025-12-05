const { Task, recurrencyType, Element, JobExecution, Job, 
  JobStatus, Maintenance_List, maintenanceLevel, ElemetModel, 
  VocalNote, TextNote, PhotographicNote, Team } = require("../models");

exports.getTasks = async (req, res) => {
  try {
    const { ship_id, userId } = req.query;

    if (!ship_id || !userId) {
      return res.status(400).json({ error: "Missing ship_id or user_id" });
    }

    const whereClause = { ship_id };

    const jobs = await JobExecution.findAll({
      where: whereClause,
      order: [["ending_date", "ASC"]],
      include: [
        {
          model: Maintenance_List,
          as: "maintenance_list",
          required: true,
          include: [
            {
              model: maintenanceLevel,
              as: "maintenance_level",
              required: false,
            },
            {
              model: recurrencyType,
              as: "recurrency_type",
              required: false,
            },
          ],
        },
        {
          model: recurrencyType,
          as: "recurrency_type",
          required: false,
        },
        {
          model: JobStatus,
          as: "status",
          required: false,
        },
        {
          model: Element,
          as: "Element",
          required: false,
          include: [
            {
              model: ElemetModel,
              as: "element_model",
              required: false,
            },
          ],
        },
        {
          model: VocalNote,
          as: "vocalNotes",
          where: { type: "maintenance" },
          required: false,
        }, 
        {
          model: TextNote,
          as: "textNotes",
          where: { type: "maintenance" },
          required: false,
        },
        {
          model: PhotographicNote,
          as: "photographicNotes",
          where: { type: "maintenance" },
          required: false,
        },
      ],
    });

    // 🔍 Filtra solo quelli con Check_List === "1"
    const checklistJobs = jobs.filter(
      (job) => job.maintenance_list?.Check_List === "1"
    );

    res.status(200).json({ tasks: checklistJobs });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Error fetching tasks" });
  }
};


exports.getTypes = async (req, res) => {
  try {

    const maintenanceTypes = await recurrencyType.findAll({
      where: {
        name: ["Manutenzioni ordinarie", "Manutenzioni straordinarie", "Manutenzioni annuali", "Manutenzioni extra"],
      },
    });

    const typeIds = maintenanceTypes.map((type) => type.id);

    res.status(200).json({ types: typeIds });

  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Error fetching tasks" });
  }
};