const { ProjectCommission, Ship, Shipyards,
   shipModel, JobExecution, Maintenance_List, sequelize } = require("../../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.getProjects = async (req, res) => {
  try {
    const projects = await ProjectCommission.findAll({});
    return res.json(projects);
  } catch (error) {
    console.error("Errore nel recupero commesse:", error);
    return res.status(500).json({ error: "Errore nel recupero commesse" });
  }
}; 

exports.createProject = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { general, ship } = req.body;

    if (!general) {
      await t.rollback();
      return res.status(400).json({ error: "Dati generali mancanti" });
    }

    const {
      name,
      description,
      houseofride,
      owner_id,
      shipyard_builder_id,
      date_order,
      date_delivery,
    } = general;

    if (!name || !owner_id) {
      await t.rollback();
      return res
        .status(400)
        .json({ error: "Nome e amministratore obbligatori" });
    }

    // 1️⃣ CREA COMMESSA
    const project = await ProjectCommission.create(
      {
        name,
        description,
        houseofride,
        owner_id,
        shipyard_builder_id: shipyard_builder_id || null,
        date_order,
        date_delivery,
      },
      { transaction: t }
    );

    // 2️⃣ MODELLI + NAVI
    if (ship?.shipsByModel) {
      for (const [modelId, ships] of Object.entries(ship.shipsByModel)) {

        // 🔹 assegna modello esistente alla commessa
        const model = await shipModel.findByPk(modelId, { transaction: t });

        if (!model) {
          await t.rollback();
          return res.status(404).json({
            error: `Modello nave ${modelId} non trovato`,
          });
        }

        await model.update(
          { commission_id: project.id },
          { transaction: t }
        );

        // 🔹 crea le navi
        for (const shipData of ships) {
          await Ship.create(
            {
              ship_model_id: model.id,
              unit_name: shipData.name,
            },
            { transaction: t }
          );
        }
      }
    }

    await t.commit();

    return res.status(201).json(project);

  } catch (error) {
    await t.rollback();
    console.error("Errore creando commessa completa:", error);
    return res.status(500).json({
      error: "Errore creando commessa con modelli e navi",
    });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await ProjectCommission.findByPk(id, {
      include: [
        {
          model: Shipyards,
          as: "shipyard",
        },
        {
          model: Ship,
          as: "ships",
        },
      ],
    });

    if (!project) {
      return res.status(404).json({ error: "Commessa non trovata" });
    }

    return res.json(project);
  } catch (error) {
    console.error("Errore nel recupero commessa:", error);
    return res.status(500).json({ error: "Errore nel recupero commessa" });
  }
};

exports.getShipModelsByProject = async (req, res) => {
  try {
    const { id } = req.params;

    // Esempio: trova i modelli nave collegati a quella commessa
    const shipModels = await shipModel.findAll({
      where: { commission_id: id },
    });

    if (!shipModels || shipModels.length === 0) {
      return res.json([]); // nessun modello trovato
    }

    return res.json(shipModels);
  } catch (error) {
    console.error("Errore nel recupero modelli nave:", error);
    return res.status(500).json({ error: "Errore nel recupero modelli nave" });
  }
};

exports.updateProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      date_order,
      date_delivery,
      owner_id,
      shipyard_builder_id,
    } = req.body;

    // 🔍 Trova la commessa
    const project = await ProjectCommission.findByPk(id);

    if (!project) {
      return res.status(404).json({ error: "Commessa non trovata" });
    }

    // 🔄 Aggiorna i campi modificabili
    project.name = name ?? project.name;
    project.description = description ?? project.description;
    project.date_order = date_order ?? project.date_order;
    project.date_delivery = date_delivery ?? project.date_delivery;
    project.owner_id = owner_id ?? project.owner_id;
    project.shipyard_builder_id =
      shipyard_builder_id ?? project.shipyard_builder_id;

    await project.save();

    return res.json({
      message: "Commessa aggiornata con successo",
      project,
    });
  } catch (error) {
    console.error("Errore durante l'aggiornamento della commessa:", error);
    return res
      .status(500)
      .json({ error: "Errore durante l'aggiornamento della commessa" });
  }
};

exports.createShipModel = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { model_name } = req.body;

    if (!model_name) {
      return res.status(400).json({ error: "Il nome del modello è obbligatorio" });
    } 

    // Verifica che la commessa esista
    const project = await ProjectCommission.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ error: "Commessa non trovata" });
    }

    // Crea il modello nave
    const newShipModel = await shipModel.create({
      model_name,
      commission_id: projectId,
    });

    return res.status(201).json({
      success: true,
      message: "Modello nave creato con successo",
      model: newShipModel,
    });

  } catch (error) {
    console.error("Errore creando modello nave:", error);
    return res.status(500).json({
      error: "Errore durante la creazione del modello nave",
    });
  }
};

exports.createShip = async (req, res) => {
  try {
    const { modelId } = req.params;
    const { unit_name, team_id } = req.body;

    if (!unit_name) {
      return res.status(400).json({ error: "Il nome della nave è obbligatorio" });
    }

    // Verifica che il modello nave esista
    const model = await shipModel.findByPk(modelId);
    if (!model) {
      return res.status(404).json({ error: "Modello nave non trovato" });
    }

    // Crea la nave
    const newShip = await Ship.create({
      ship_model_id: modelId,
      unit_name,
      team: team_id,
    });

    return res.status(201).json({
      success: true,
      message: "Nave creata con successo",
      ship: newShip,
    });

  } catch (error) {
    console.error("Errore durante creazione nave:", error);
    return res.status(500).json({
      error: "Errore durante creazione nave",
    });
  }
};

exports.getProjectRuntime = async (req, res) => {
  try {
    const { ship_id } = req.params;

    const runtime = await JobExecution.findAll({
      where: { ship_id }, // filtro corretto
      include: [
        {
          model: Maintenance_List,
          as: "maintenance_list",
          required: false
        }
      ]
    });

    return res.json(runtime);
  } catch (error) {
    console.error("Errore nel recupero runtime:", error);
    return res.status(500).json({ error: "Errore nel recupero runtime" });
  }
};

exports.startJobExecution = async (req, res) => {
  try {
    const { ship_id } = req.params;
    const { project_id } = req.params;

    const existingJobs = await JobExecution.findOne({ where: { ship_id } });

    if (existingJobs) {
      return res.status(400).json({
        error: "Job già avviati per questa nave. Start bloccato."
      });
    } 

    const maintenanceList = await Maintenance_List.findAll({
      where: { id_ship: project_id }
    });

    if (!maintenanceList.length) {
      return res.status(404).json({
        error: "Nessuna maintenance associata alla nave."
      });
    }

    // Creazione batch delle entry jobExecution
    const createdJobs = await Promise.all(
      maintenanceList.map((m) =>
        JobExecution.create({
          job_id: m.id,
          ship_id,
          execution_state: "pending",
          status_id: 1,
          starting_date: new Date(),
        })
      )
    );

    return res.status(201).json({
      message: "Job avviati con successo",
      count: createdJobs.length,
      jobs: createdJobs,
    });

  } catch (error) {
    console.error("Errore avvio jobs:", error);
    return res.status(500).json({ error: "Errore durante avvio dei job" });
  }
};

