const { recurrencyType, maintenanceLevel, Maintenance_List, Team,
  JobExecution, Job, Spare, JobStatus, Element, ElemetModel, StatusCommentsMaintenance, VocalNote, 
  TextNote, PhotographicNote, User } = require("../models");

require('dotenv').config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { Op } = require("sequelize");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const s3 = new AWS.S3();

const BUCKET_NAME = 'scia-project-questit';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

exports.getJobs = async (req, res) => {
  try {
    const { type_id, ship_id, user_id } = req.query;

    if (!ship_id || !user_id) {
      return res.status(400).json({ error: "Missing ship_id or user_id" });
    }

    const whereClause = { ship_id };
    if (type_id && type_id !== "undefined") whereClause.recurrency_type_id = type_id;

    const jobs = await JobExecution.findAll({
      where: whereClause,
      order: [["ending_date", "ASC"]],
      include: [
        {
          model: Maintenance_List,
          as: "maintenance_list",
          required: false,
          include: [
            { model: maintenanceLevel, as: "maintenance_level", required: false },
            { model: recurrencyType, as: "recurrency_type", required: false },

            { model: ElemetModel, as: "system_element_model", required: false },
            { model: ElemetModel, as: "end_item_element_model", required: false },
            { model: ElemetModel, as: "maintenance_item_element_model", required: false },
          ],
        },
        { model: JobStatus, as: "status", required: false },
        {
          model: Element,
          as: "Element",
          required: false,
          include: [{ model: ElemetModel, as: "element_model", required: false }],
        },
        { model: VocalNote, as: "vocalNotes", where: { type: "maintenance" }, required: false },
        { model: TextNote, as: "textNotes", where: { type: "maintenance" }, required: false },
        { model: PhotographicNote, as: "photographicNotes", where: { type: "maintenance" }, required: false },
      ],
    });

    // 📌 Per ogni job, calcolo la lista di tutti i model_id possibili
    const enrichedJobs = await Promise.all(
      jobs.map(async (job) => {
        const ml = job.maintenance_list;
        const elementModel = job.Element?.element_model;

        const modelIds = [
          elementModel?.id,
          ml?.System_ElementModel_ID,
          ml?.End_Item_ElementModel_ID,
          ml?.Maintenance_Item_ElementModel_ID,
        ].filter(Boolean);

        // 🔍 Trova tutti gli spare collegati ai modelIds
        const spares = await Spare.findAll({
          where: { element_model_id: modelIds },
        });

        return {
          ...job.toJSON(),
          spares,
        };
      })
    );

    res.status(200).json({ jobs: enrichedJobs });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: "Error fetching jobs" });
  }
};

exports.getTypes = async (req, res) => {
  try {
    const { ship_id, user_id } = req.query;

    if (!ship_id || !user_id) {
      return res.status(400).json({ error: "Missing ship_id or user_id" });
    }

    const maintenanceTypes = await recurrencyType.findAll();
    const formattedData = [];

    for (const type of maintenanceTypes) {
      const recurrencyTypeId = type.id;

      const lastExecution = await JobExecution.findOne({
        where: {
          recurrency_type_id: recurrencyTypeId,
          ship_id,
          user_id,
          execution_date: { [Op.ne]: null }
        },
        order: [["execution_date", "DESC"]]
      });

      const upcomingDue = await JobExecution.findOne({
        where: {
          recurrency_type_id: recurrencyTypeId,
          ship_id,
          user_id,
          ending_date: {
            [Op.gt]: new Date()
          }
        },
        order: [["ending_date", "ASC"]]
      });

      const jobCount = await JobExecution.count({
        where: {
          recurrency_type_id: recurrencyTypeId,
          ship_id,
          user_id
        }
      });

      formattedData.push({
        id: recurrencyTypeId,
        title: type.name,
        tasks: jobCount,
        lastExecution: lastExecution?.execution_date?.toISOString() || "N/A",
        dueDate: upcomingDue?.ending_date?.toISOString() || "N/A"
      });
    }

    return res.status(200).json({ maintenanceTypes: formattedData });

  } catch (error) {
    console.error("Error fetching maintenance types:", error);
    return res.status(500).json({ error: "Error fetching maintenance types" });
  }
};

exports.getGeneralTypes = async (req, res) => {
  try {

    const generalTypes = await recurrencyType.findAll();

    return res.status(200).json(generalTypes);

  } catch (error) {
    console.error("Error fetching maintenance types:", error);
    return res.status(500).json({ error: "Error fetching maintenance types" });
  }
};

exports.getMaintenanceLevels = async (req, res) => {
  try {

    const generalLevels = await maintenanceLevel.findAll();

    return res.status(200).json(generalLevels);

  } catch (error) {
    console.error("Error fetching maintenance types:", error);
    return res.status(500).json({ error: "Error fetching maintenance types" });
  }
};

exports.getJob = async (req, res) => {
  try {
    const { taskId, page } = req.query;

    if (!taskId) {
      return res.status(400).json({ error: "Missing taskId" });
    }

    // ⭐ Recupera tutta la JobExecution con tutti i modelli collegati
    const jobs = await JobExecution.findAll({
      where: { id: taskId },
      order: [["ending_date", "ASC"]],
      include: [
        {
          model: Maintenance_List,
          as: "maintenance_list",
          include: [
            { model: maintenanceLevel, as: "maintenance_level" },
            { model: recurrencyType, as: "recurrency_type" },

            { model: ElemetModel, as: "system_element_model" },
            { model: ElemetModel, as: "end_item_element_model" },
            { model: ElemetModel, as: "maintenance_item_element_model" },
          ],
        },

        { model: recurrencyType, as: "recurrency_type" },
        { model: JobStatus, as: "status" },

        {
          model: Element,
          as: "Element",
          include: [
            {
              model: ElemetModel,
              as: "element_model",
            },
          ],
        },
      ],
    });

    // -----------------------------------------------------------
    //    FUNZIONE PER RECUPERARE SPARES DEI 4 ELEMENT MODEL
    // -----------------------------------------------------------
    const getSparesForModels = async (models) => {
      const ids = models
        .filter(Boolean)
        .map((m) => m.id);

      if (ids.length === 0) return [];

      return await Spare.findAll({
        where: { element_model_id: ids },
      });
    };

    // -----------------------------------------------------------
    //       GENERAZIONE URL S3 (rimasto invariato)
    // -----------------------------------------------------------
    const getSignedFileUrl = async (fileName) => {
      try {
        const list = await s3
          .listObjectsV2({
            Bucket: BUCKET_NAME,
            Prefix: "",
          })
          .promise();

        const found = list.Contents.find((obj) =>
          obj.Key.toLowerCase().includes(fileName.toLowerCase())
        );

        if (!found) return null;

        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: found.Key,
        });

        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      } catch (err) {
        console.error("Errore cercando file su S3:", err);
        return null;
      }
    };

    // -----------------------------------------------------------
    //     ARRICCHIMENTO RISPOSTA (AGGIUNGO SPARES)
    // -----------------------------------------------------------
    const enrichedJobs = await Promise.all(
      jobs.map(async (job) => {
        
        // 🔹 Estrai i 4 model
        const models = [
          job.Element?.element_model,
          job.maintenance_list?.system_element_model,
          job.maintenance_list?.end_item_element_model,
          job.maintenance_list?.maintenance_item_element_model,
        ];

        // 🔹 Recupera spare collegati
        const spares = await getSparesForModels(models);

        // 🔹 Genera URL PDF
        let documentFileUrl = null;
        const referenceDoc = job.maintenance_list?.Reference_document;

        if (referenceDoc) {
          documentFileUrl = await getSignedFileUrl(referenceDoc);
          const desiredPage = page || job.maintenance_list?.page;
          if (documentFileUrl && desiredPage) {
            documentFileUrl = `${documentFileUrl}#page=${desiredPage}`;
          }
        }

        return {
          ...job.toJSON(),
          spares, // ⭐ aggiungo gli spare in risposta
          documentFileUrl,
        };
      })
    );

    res.status(200).json({ jobs: enrichedJobs });

  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ error: "Error fetching job" });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const jobExecutionId = req.params.id;
    const { status_id } = req.body;

    if (!status_id || ![1, 2, 3, 4, 5, 6].includes(Number(status_id))) {
      return res.status(400).json({ error: "Invalid or missing status_id. Allowed values: 1 (Attivo), 2 (In pausa), 3 (Non attivo)" });
    }

    const jobExecution = await JobExecution.findByPk(jobExecutionId);

    if (!jobExecution) {
      return res.status(404).json({ error: "JobExecution not found" });
    }
 
    jobExecution.status_id = status_id;

    if(status_id){
      jobExecution.pauseDate = Date.now();
    }
 
    await jobExecution.save();

    res.status(200).json({ message: "Status updated successfully", jobExecution });

  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ error: "Error updating status" });
  }
};

exports.saveStatusComment = async (req, res) => {
  try {
    const jobExecutionId = req.params.id;
    const {
      date,
      date_flag,
      reason,
      only_this,
      all_from_this_product,
      old_status_id,
      new_status_id,
    } = req.body;

    if (!new_status_id || ![1, 2, 3].includes(Number(new_status_id))) {
      return res.status(400).json({
        error: "Invalid or missing new_status_id. Allowed values: 1 (Attivo), 2 (In pausa), 3 (Non attivo)",
      });
    }

    const jobExecution = await JobExecution.findByPk(jobExecutionId);
    if (!jobExecution) {
      return res.status(404).json({ error: "JobExecution not found" });
    }

    // Aggiorna stato jobExecution
    jobExecution.status_id = new_status_id;
    await jobExecution.save();

    // Salva commento
    await StatusCommentsMaintenance.create({
      maintenance_id: jobExecutionId,
      date: date || new Date(),
      date_flag: date_flag || null,
      reason: reason || null,
      only_this: only_this || null,
      all_from_this_product: all_from_this_product || null,
      old_status_id: old_status_id || jobExecution.status_id, // fallback
      new_status_id,
    });

    res.status(200).json({
      message: "Status and comment saved successfully",
      jobExecution,
    });
  } catch (error) {
    console.error("Error updating status and saving comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const formatDate = (date) => date.toISOString().slice(0, 19).replace("T", " ") + ".000";

exports.reportAnomaly = async (req, res) => {
  try {
    const jobExecutionId = req.params.id;
    const { mark } = req.body;

    const jobExecution = await JobExecution.findByPk(jobExecutionId);

    if (!jobExecution) {
      return res.status(404).json({ error: "JobExecution not found" });
    }

    // -------------------------------
    // 🛑 CASO ANOMALIA (mark === 3)
    // -------------------------------
    if (mark === 3) {
      jobExecution.execution_state = 3;

      // ❌ NON aggiornare execution_date
      // ❌ NON aggiornare ending_date
      // ❌ NON creare nuova istanza

      await jobExecution.save();

      return res.status(200).json({
        message: "Anomaly reported. No new execution created.",
        updated: jobExecution
      });
    }

    // --------------------------------------------------------
    // ✔️ CASI NORMALI (mark = 0,1,2 ecc → continua la ricorrenza)
    // --------------------------------------------------------
    const recurrencyInfo = await recurrencyType.findByPk(jobExecution.recurrency_type_id);

    if (!recurrencyInfo || !recurrencyInfo.to_days) {
      return res.status(400).json({ error: "Missing recurrency rule (to_days)" });
    }

    const today = new Date();
    const nextEndDate = new Date();
    nextEndDate.setDate(nextEndDate.getDate() + recurrencyInfo.to_days);

    jobExecution.execution_state = mark;
    jobExecution.execution_date = today;
    jobExecution.ending_date = today;
    await jobExecution.save();

    const newExecution = await JobExecution.create({
      job_id: jobExecution.job_id,
      status_id: jobExecution.status_id,
      user_id: jobExecution.user_id,
      element_eswbs_instance_id: jobExecution.element_eswbs_instance_id,
      starting_date: formatDate(today),
      ending_date: formatDate(nextEndDate),
      data_recovery_expiration: jobExecution.data_recovery_expiration,
      attachment_link: null,
      recurrency_type_id: jobExecution.recurrency_type_id,
      ship_id: jobExecution.ship_id,
      execution_state: null,
      pauseDate: null
    });  

    return res.status(200).json({
      message: "Execution completed. Next execution scheduled.",
      completed: jobExecution,
      nextExecution: newExecution
    });

  } catch (error) {
    console.error("Error reporting anomaly:", error);
    res.status(500).json({ error: "Error reporting anomaly" });
  }
};

exports.markAsOk = async (req, res) => {
  try {
    const jobExecutionId = req.params.id;
    const mark = 1;

    console.log("markAsOk jobExecutionId:", jobExecutionId);

    const jobExecution = await JobExecution.findByPk(jobExecutionId);

    if (!jobExecution) {
      return res.status(404).json({ error: "JobExecution not found" });
    }

    // ── Trova recurrency_type_id (diretto o dalla Maintenance_List) ──────────
    let recurrencyTypeId = jobExecution.recurrency_type_id;

    if (!recurrencyTypeId) {
      // Fallback: cerca il job con la sua maintenance_list
      const jobWithList = await JobExecution.findByPk(jobExecutionId, {
        include: [
          {
            model: Maintenance_List,
            as: "maintenance_list",
            include: [{ model: recurrencyType, as: "recurrency_type" }],
          },
        ],
      });

      recurrencyTypeId = jobWithList?.maintenance_list?.recurrency_type?.id ?? null;
      console.log("Fallback recurrencyTypeId dalla maintenance_list:", recurrencyTypeId);
    }

    if (!recurrencyTypeId) {
      return res.status(400).json({ error: "Missing recurrency_type_id on JobExecution and on Maintenance_List" });
    }

    const recurrencyInfo = await recurrencyType.findByPk(recurrencyTypeId);

    // ── Calcola to_days anche se manca il campo (da name) ─────────────────────
    let toDays = recurrencyInfo?.to_days;

    if (!toDays && recurrencyInfo?.name) {
      const n = recurrencyInfo.name.toLowerCase();
      if (n.includes("daily")   || n.includes("giorn"))  toDays = 1;
      if (n.includes("weekly")  || n.includes("settim")) toDays = 7;
      if (n.includes("biweekly"))                         toDays = 14;
      if (n.includes("monthly") || n.includes("mensil")) toDays = 30;
      if (n.includes("bimest"))                           toDays = 60;
      if (n.includes("trimestr") || n.includes("quarter")) toDays = 90;
      if (n.includes("semest"))                           toDays = 180;
      if (n.includes("annual")  || n.includes("annual") || n.includes("annua")) toDays = 365;
      if (n.includes("bienni"))                           toDays = 730;
      if (n.includes("trienni"))                          toDays = 1095;

      // "every X days/weeks/months"
      const m = n.match(/every\s+([\d.]+)\s*(day|week|month|year)/i);
      if (m) {
        const q = parseFloat(m[1]);
        const u = m[2].toLowerCase();
        if (u.startsWith("day"))   toDays = Math.round(q);
        if (u.startsWith("week"))  toDays = Math.round(q * 7);
        if (u.startsWith("month")) toDays = Math.round(q * 30);
        if (u.startsWith("year"))  toDays = Math.round(q * 365);
      }

      console.log(`Derived to_days from name "${recurrencyInfo.name}":`, toDays);
    }

    if (!toDays) {
      return res.status(400).json({
        error: `Missing recurrency rule (to_days). recurrency_type_id=${recurrencyTypeId}, name="${recurrencyInfo?.name}"`,
      });
    }

    const today = new Date();
    const nextEndDate = new Date();
    nextEndDate.setDate(nextEndDate.getDate() + toDays);

    // ── Aggiorna esecuzione attuale ───────────────────────────────────────────
    jobExecution.execution_state = mark;
    jobExecution.ending_date     = today;
    jobExecution.execution_date  = today;
    await jobExecution.save();

    // ── Crea nuova esecuzione ─────────────────────────────────────────────────
    const newExecution = await JobExecution.create({
      job_id:                      jobExecution.job_id,
      status_id:                   jobExecution.status_id,
      user_id:                     jobExecution.user_id,
      element_eswbs_instance_id:   jobExecution.element_eswbs_instance_id,
      starting_date:               formatDate(today),
      ending_date:                 formatDate(nextEndDate),
      data_recovery_expiration:    jobExecution.data_recovery_expiration,
      attachment_link:             null,
      recurrency_type_id:          recurrencyTypeId,
      ship_id:                     jobExecution.ship_id,
      execution_state:             null,
      pauseDate:                   null,
    });

    return res.status(200).json({
      message: "Maintenance marked OK. Next execution scheduled.",
      completed:     jobExecution,
      nextExecution: newExecution,
    }); 

  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ error: "Error updating status" });
  }
};

