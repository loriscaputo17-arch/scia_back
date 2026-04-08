const { Task, recurrencyType, Element, JobExecution, Job, 
  JobStatus, Maintenance_List, maintenanceLevel, ElemetModel, 
  VocalNote, TextNote, PhotographicNote, Team } = require("../models");

exports.getTasks = async (req, res) => {
  try {
    const { ship_id, userId, page = 1, limit = 30, nascondiEseguiti, macrogroups, squadre, type_id } = req.query;

    if (!ship_id || !userId) {
      return res.status(400).json({ error: "Missing ship_id or user_id" });
    }

    const offset = (Number(page) - 1) * Number(limit);
    const limitN = Number(limit);

    const jobs = await JobExecution.findAll({
      where: { ship_id },
      order: [["ending_date", "ASC"]],
      include: [
        {
          model: Maintenance_List,
          as: "maintenance_list",
          required: true,
          include: [
            { model: maintenanceLevel, as: "maintenance_level", required: false },
            { model: recurrencyType,   as: "recurrency_type",   required: false },
          ],
        },
        { model: recurrencyType, as: "recurrency_type", required: false },
        { model: JobStatus,      as: "status",          required: false },
        {
          model: Element, as: "Element", required: false,
          include: [{ model: ElemetModel, as: "element_model", required: false }],
        },
        { model: VocalNote,        as: "vocalNotes",        where: { type: "maintenance" }, required: false },
        { model: TextNote,         as: "textNotes",         where: { type: "maintenance" }, required: false },
        { model: PhotographicNote, as: "photographicNotes", where: { type: "maintenance" }, required: false },
      ],
    });

    // Filtra solo checklist
    let filtered = jobs.filter((job) => job.maintenance_list?.Check_List === "1");

    // Nascondi eseguiti
    if (nascondiEseguiti === "1") {
      filtered = filtered.filter((job) => job.execution_state === null);
    }

    // Filtro macrogruppi ESWBS
    if (macrogroups) {
      const digits = macrogroups.split(",");
      filtered = filtered.filter((job) => {
        const code = job.Element?.element_model?.ESWBS_code?.trim();
        return code && digits.includes(code[0]);
      });
    }

    // Filtro squadra
    if (squadre) {
      const squadreList = squadre.split(",");
      filtered = filtered.filter((job) => {
        const team = job.assigned_to?.team;
        return team && squadreList.includes(team);
      });
    }

    // Filtro type
    if (type_id) {
      filtered = filtered.filter((job) => job.recurrency_type_id === parseInt(type_id));
    }

    // Ordina: execution_state null prima
    filtered.sort((a, b) => {
      // execution_state === "2" o === "1" → in fondo a tutto
      const aFondo = a.execution_state === "2" || a.execution_state === 2 || a.execution_state === "1" || a.execution_state === 1;
      const bFondo = b.execution_state === "2" || b.execution_state === 2 || b.execution_state === "1" || b.execution_state === 1;
      if (aFondo !== bFondo) return aFondo ? 1 : -1;

      // execution_state !== null (eseguiti) → dopo i null
      const aDone = a.execution_state !== null;
      const bDone = b.execution_state !== null;
      if (aDone !== bDone) return aDone ? 1 : -1;

      return 0;
    });

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limitN).map(job => job.toJSON());

    res.status(200).json({
      tasks: paginated,
      total,
      hasMore: offset + limitN < total,
    });

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