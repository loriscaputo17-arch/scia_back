const { recurrencyType, maintenanceLevel, Maintenance_List, Team,
  JobExecution, Job, JobStatus, Element, ElemetModel, StatusCommentsMaintenance, VocalNote, 
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


    res.status(200).json({ jobs });
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

    // 🔹 Recupera la singola JobExecution con join diretta alla Maintenance_List
    const jobs = await JobExecution.findAll({
      where: { id: taskId },
      order: [["ending_date", "ASC"]],
      include: [
        {
          model: Maintenance_List,
          as: "maintenance_list",
          required: false,
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
      ],
    });

    // 🔹 Funzione per generare link firmato S3
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

    // 🔹 Aggiungo documentFileUrl con pagina opzionale
    const enrichedJobs = await Promise.all(
      jobs.map(async (job) => {
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
    const mark = 2; // ANOMALIA

    const jobExecution = await JobExecution.findByPk(jobExecutionId);

    if (!jobExecution) {
      return res.status(404).json({ error: "JobExecution not found" });
    }

    const recurrencyInfo = await recurrencyType.findByPk(jobExecution.recurrency_type_id);

    if (!recurrencyInfo || !recurrencyInfo.to_days) {
      return res.status(400).json({ error: "Missing recurrency rule (to_days)" });
    }

    const today = new Date();
    const nextEndDate = new Date();
    nextEndDate.setDate(nextEndDate.getDate() + recurrencyInfo.to_days);

    // ---- Aggiorna la JobExecution attuale ----
    jobExecution.execution_state = mark;
    jobExecution.ending_date = today;
    await jobExecution.save();

    // ---- Crea nuova esecuzione programmata ----
    const newExecution = await JobExecution.create({
      job_id: jobExecution.job_id,
      status_id: jobExecution.status_id,
      user_id: jobExecution.user_id,
      element_eswbs_instance_id: jobExecution.element_eswbs_instance_id,
      starting_date: formatDate(today),      // 👈 sempre oggi
      ending_date: formatDate(nextEndDate),  // 👈 calcolato con recurrency
      data_recovery_expiration: jobExecution.data_recovery_expiration,
      execution_date: formatDate(today),     // 👈 sempre oggi
      attachment_link: null,
      recurrency_type_id: jobExecution.recurrency_type_id,
      ship_id: jobExecution.ship_id,
      execution_state: null,
      pauseDate: null
    });

    return res.status(200).json({
      message: "Anomaly reported. Future execution scheduled.",
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

    const jobExecution = await JobExecution.findByPk(jobExecutionId);

    if (!jobExecution) {
      return res.status(404).json({ error: "JobExecution not found" });
    }

    const recurrencyInfo = await recurrencyType.findByPk(jobExecution.recurrency_type_id);

    if (!recurrencyInfo || !recurrencyInfo.to_days) {
      return res.status(400).json({ error: "Missing recurrency rule (to_days)" });
    }

    const today = new Date();
    const nextEndDate = new Date();
    nextEndDate.setDate(nextEndDate.getDate() + recurrencyInfo.to_days);

    // ---- Aggiorna esecuzione attuale ----
    jobExecution.execution_state = mark;
    jobExecution.ending_date = today;
    await jobExecution.save();

    // ---- Nuova esecuzione ----
    const newExecution = await JobExecution.create({
      job_id: jobExecution.job_id,
      status_id: jobExecution.status_id,
      user_id: jobExecution.user_id,
      element_eswbs_instance_id: jobExecution.element_eswbs_instance_id,
      starting_date: formatDate(today),      // 👈 sempre oggi
      ending_date: formatDate(nextEndDate),  // 👈 calcolato
      data_recovery_expiration: jobExecution.data_recovery_expiration,
      execution_date: formatDate(today),     // 👈 sempre oggi
      attachment_link: null,
      recurrency_type_id: jobExecution.recurrency_type_id,
      ship_id: jobExecution.ship_id,
      execution_state: null,
      pauseDate: null
    });

    return res.status(200).json({
      message: "Maintenance marked OK. Next execution scheduled.",
      completed: jobExecution,
      nextExecution: newExecution
    });

  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ error: "Error updating status" });
  }
};

