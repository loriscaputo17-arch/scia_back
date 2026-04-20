const { recurrencyType, maintenanceLevel, Maintenance_List, Team,
  JobExecution, Spare, JobStatus, Element, ElemetModel, StatusCommentsMaintenance, VocalNote, 
  TextNote, PhotographicNote, sequelize, Maintenance_ListConsumable,
   Maintenance_ListTools, Consumable, Maintenance_ListSpare, Tool } = require("../models");

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

const { createNotification } = require("../services/notificationService");

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
    const { type_id, page = 1, limit = 30, stato, ricorrenza, livello, ricambi, element_id, eswbs_code, days_from, days_to } = req.query;
    
    if (Array.isArray(eswbs_code)) {
      eswbs_code = eswbs_code[0];
    }
    
    const ship_id = req.shipAccess?.shipId;

    if (!ship_id) return res.status(400).json({ error: "Missing ship_id" });

    const offset = (Number(page) - 1) * Number(limit);
    const limitN  = Number(limit);

    const typeFilter = (type_id && type_id !== "undefined")
      ? `AND je.recurrency_type_id = ${parseInt(type_id)}`
      : "";

    const recurrenceMap = {
      settimanale:   [2],
      bisettimanale: [7],
      mensile:       [3],
      bimestrale:    [8],
      trimestrale:   [4],
      semestrale:    [30, 40],
      annuale:       [5],
      biennale:      [9],
      triennale:     [10],
    };

    const levelMap = {
      aBordo:           [1, 2],    
      inBanchina:       [3],       
      inBacino:         [5, 6],    
      fornitoreEsterno: [4],       
    };

    let extraFilters = "";

    if (ricorrenza) {
      const keys = ricorrenza.split(",");
      const ids = keys.flatMap((k) => recurrenceMap[k] || []);
      if (ids.length) {
        extraFilters += ` AND je.recurrency_type_id IN (${ids.join(",")})`;
      }
    }

    if (livello) {
      const keys = livello.split(",");
      const ids = keys.flatMap((k) => levelMap[k] || []);
      console.log("livello filter:", { keys, ids });
      if (ids.length) {
        extraFilters += ` AND ml.MaintenanceLevel_ID IN (${ids.map(id => `'${id}'`).join(",")})`;
      }
    }

    {/*if (element_id) {
      extraFilters += ` AND je.element_eswbs_instance_id = ${parseInt(element_id)}`;
    }*/}

    if (eswbs_code) {
      extraFilters += `
        AND (
          em.LCN LIKE '${eswbs_code}%'
          OR em_sys.LCN LIKE '${eswbs_code}%'
          OR em_end.LCN LIKE '${eswbs_code}%'
          OR em_maint.LCN LIKE '${eswbs_code}%'
        )
      `;
    }

    if (days_from || days_to) {
      const from = days_from ? parseInt(days_from) : null;
      const to   = days_to   ? parseInt(days_to)   : null;

      if (from !== null && to !== null) {
        extraFilters += ` AND rt.to_days BETWEEN ${from} AND ${to}`;
      } else if (from !== null) {
        extraFilters += ` AND rt.to_days >= ${from}`;
      } else if (to !== null) {
        extraFilters += ` AND rt.to_days <= ${to}`;
      }
    }

    const filterRicambi = ricambi === "richiesti";

    const [rows] = await sequelize.query(`
      SELECT
        je.id,
        je.job_id,
        je.status_id,
        je.pauseDate,
        je.user_id,
        je.element_eswbs_instance_id,
        je.starting_date,
        je.ending_date,
        je.data_recovery_expiration,
        je.execution_date,
        je.attachment_link,
        je.recurrency_type_id,
        je.ship_id,
        je.execution_state,
        rt.delay_threshold,
        rt.due_threshold,
        rt.early_threshold,
        ml.MaintenanceLevel_ID,

        -- ── Calcolo scadenza in SQL ─────────────────────────────────────────
        CASE
          WHEN je.execution_date IS NOT NULL AND rt.to_days > 0
            THEN DATE_ADD(je.execution_date, INTERVAL rt.to_days DAY)

          WHEN je.execution_date IS NOT NULL AND LOWER(rt.name) REGEXP 'every[[:space:]]+[0-9.,]+[[:space:]]+(hour|hours)'
            THEN DATE_ADD(je.execution_date, INTERVAL
              ROUND(
                CAST(REPLACE(REPLACE(
                  REGEXP_SUBSTR(LOWER(rt.name), '[0-9.,]+'), '.', ''), ',', '.') AS DECIMAL(10,2))
                / 24
              ) DAY)

          WHEN je.execution_date IS NOT NULL AND LOWER(rt.name) REGEXP 'every[[:space:]]+[0-9.,]+[[:space:]]+(day|days)'
            THEN DATE_ADD(je.execution_date, INTERVAL
              CAST(REPLACE(REPLACE(
                REGEXP_SUBSTR(LOWER(rt.name), '[0-9.,]+'), '.', ''), ',', '.') AS DECIMAL(10,2))
              DAY)

          WHEN je.execution_date IS NOT NULL AND LOWER(rt.name) REGEXP 'every[[:space:]]+[0-9.,]+[[:space:]]+(week|weeks)'
            THEN DATE_ADD(je.execution_date, INTERVAL
              ROUND(
                CAST(REPLACE(REPLACE(
                  REGEXP_SUBSTR(LOWER(rt.name), '[0-9.,]+'), '.', ''), ',', '.') AS DECIMAL(10,2))
                * 7
              ) DAY)

          WHEN je.execution_date IS NOT NULL AND LOWER(rt.name) REGEXP 'every[[:space:]]+[0-9.,]+[[:space:]]+(month|months)'
            THEN DATE_ADD(je.execution_date, INTERVAL
              CAST(REPLACE(REPLACE(
                REGEXP_SUBSTR(LOWER(rt.name), '[0-9.,]+'), '.', ''), ',', '.') AS DECIMAL(10,2))
              MONTH)

          WHEN je.execution_date IS NOT NULL AND LOWER(rt.name) REGEXP 'every[[:space:]]+[0-9.,]+[[:space:]]+(year|years)'
            THEN DATE_ADD(je.execution_date, INTERVAL
              CAST(REPLACE(REPLACE(
                REGEXP_SUBSTR(LOWER(rt.name), '[0-9.,]+'), '.', ''), ',', '.') AS DECIMAL(10,2))
              YEAR)

          -- sinonimi fissi
          WHEN je.execution_date IS NOT NULL AND LOWER(rt.name) = 'daily'
            THEN DATE_ADD(je.execution_date, INTERVAL 1 DAY)
          WHEN je.execution_date IS NOT NULL AND LOWER(rt.name) IN ('weekly', 'every 2 weeks')
            THEN DATE_ADD(je.execution_date, INTERVAL 7 DAY)
          WHEN je.execution_date IS NOT NULL AND LOWER(rt.name) = 'biweekly'
            THEN DATE_ADD(je.execution_date, INTERVAL 14 DAY)
          WHEN je.execution_date IS NOT NULL AND LOWER(rt.name) = 'monthly'
            THEN DATE_ADD(je.execution_date, INTERVAL 1 MONTH)
          WHEN je.execution_date IS NOT NULL AND LOWER(rt.name) = 'quarterly'
            THEN DATE_ADD(je.execution_date, INTERVAL 3 MONTH)
          WHEN je.execution_date IS NOT NULL AND LOWER(rt.name) IN ('semiannual','every 6 months')
            THEN DATE_ADD(je.execution_date, INTERVAL 6 MONTH)
          WHEN je.execution_date IS NOT NULL AND LOWER(rt.name) IN ('yearly','annually')
            THEN DATE_ADD(je.execution_date, INTERVAL 1 YEAR)

          -- fallback: ending_date se presente
          WHEN je.ending_date IS NOT NULL
            THEN je.ending_date

          ELSE NULL
        END AS computed_expiry_date,

        -- ── Gruppo per ordinamento ──────────────────────────────────────────
        CASE
          WHEN je.execution_state IN ('1','3') THEN 2   -- marcate → in fondo
          ELSE 0
        END AS sort_group

      FROM JobExecution je
      LEFT JOIN Maintenance ml ON ml.id = je.job_id
      LEFT JOIN RecurrencyType   rt ON rt.id  = je.recurrency_type_id
      LEFT JOIN Element e ON e.id = je.element_eswbs_instance_id
      LEFT JOIN ElementModel em ON em.id = e.element_model_id
      LEFT JOIN ElementModel em_sys   ON em_sys.id = ml.System_ElementModel_ID
      LEFT JOIN ElementModel em_end   ON em_end.id = ml.End_Item_ElementModel_ID
      LEFT JOIN ElementModel em_maint ON em_maint.id = ml.Maintenance_Item_ElementModel_ID
      WHERE je.ship_id = ${parseInt(ship_id)}
      AND je.recurrency_type_id NOT IN (6, 13)
      AND LOWER(rt.name) != 'daily'
      AND LOWER(rt.name) NOT REGEXP 'every[[:space:]]+1[[:space:]]+(day|days)$'
      ${typeFilter}
      ${extraFilters}
    `);

    // ── 2. Ordina in JS usando computed_expiry_date già calcolata ───────────
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0)

    const sorted = rows.sort((a, b) => {
      const getGroup = (job) => {
        // ✅ Completati/marcati → sempre in fondo
        if (job.execution_state === "1" || job.execution_state === "3") return 3;

        const expiry = job.computed_expiry_date ? new Date(job.computed_expiry_date) : null;
        const delay = Number(job.delay_threshold ?? 0);
        const due   = Number(job.due_threshold   ?? 0);
        const early = Number(job.early_threshold  ?? 0);

        if (expiry) {
          const expiryMidnight = new Date(expiry);
          expiryMidnight.setUTCHours(0, 0, 0, 0);
          const daysLeft = Math.ceil((expiryMidnight - today) / 86400000);

          if (daysLeft <= -delay) return 0;        // ✅ scaduta (rosso) → primissimi
          if (daysLeft <= 0)      return 1;        // ✅ scaduta da poco (arancione) → secondi
          if (daysLeft <= due)    return 2;        // ✅ in scadenza (giallo) → terzi
        }

        return 3; // attiva / programmata / nessuna scadenza → dopo
      };

      const gA = getGroup(a), gB = getGroup(b);
      if (gA !== gB) return gA - gB;

      // ── A parità di gruppo, ordina per data scadenza crescente ──
      if (!a.computed_expiry_date && !b.computed_expiry_date) return 0;
      if (!a.computed_expiry_date) return 1;
      if (!b.computed_expiry_date) return -1;

      return new Date(a.computed_expiry_date) - new Date(b.computed_expiry_date);
    });

    let filtered = sorted;
    if (stato) {
      const statiAttivi = stato.split(",");
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0)

      filtered = sorted.filter((job) => {
        const expiry = job.computed_expiry_date ? new Date(job.computed_expiry_date) : null;

        const delay = Number(job.delay_threshold ?? 0);
        const due   = Number(job.due_threshold   ?? 0);
        const early = Number(job.early_threshold  ?? 0);

        if (job.id === sorted[0]?.id) {
          console.log("SAMPLE JOB:", {
            id: job.id,
            computed_expiry_date: job.computed_expiry_date,
            expiry: expiry?.toISOString(),
            today: today.toISOString(),
            daysLeft: expiry ? Math.ceil((expiry - today) / 86400000) : null,
            early, due, delay,
            execution_state: job.execution_state,
          });
        }

        const isInPausa     = job.execution_state === "2";
        const isProgrammata = job.starting_date && new Date(job.starting_date) > today;

        // ── Calcola colore identico a StatusBadge ──────────────────────────────
        let color = "transparent";
        if (expiry) {
          const expiryMidnight = new Date(expiry);
          expiryMidnight.setUTCHours(0, 0, 0, 0);
          const daysLeft = Math.ceil((expiryMidnight - today) / 86400000);
        if      (daysLeft > early)   color = "transparent";          
          else if (daysLeft > due)     color = "green";                
          else if (daysLeft > 0)       color = "yellow";               
          else if (daysLeft >= -delay) color = "orange";               
          else                         color = "red";                  
        }

        return statiAttivi.some((s) => {
          if (s === "attiva"        && color === "green")                    return true;
          if (s === "inScadenza"    && color === "yellow")                   return true;
          if (s === "scadutaDaPoco" && color === "orange")                   return true;
          if (s === "scaduta"       && color === "red")                      return true;
          if (s === "inPausa"       && isInPausa)                           return true;
          if (s === "programmata"   && isProgrammata)                       return true;
          return false;
        });
      });
    }
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limitN);

    const enrichedJobs = await Promise.all(
      paginated.map(async (jobRaw) => {
        const job = await JobExecution.findOne({
          where: { id: jobRaw.id },
          include: [
            {
              model: Maintenance_List,
              as: "maintenance_list",
              required: false,
              include: [
                { model: maintenanceLevel, as: "maintenance_level", required: false },
                { model: recurrencyType,   as: "recurrency_type",   required: false },
                { model: ElemetModel, as: "system_element_model",            required: false },
                { model: ElemetModel, as: "end_item_element_model",          required: false },
                { model: ElemetModel, as: "maintenance_item_element_model",  required: false },
              ],
            },
            { model: JobStatus, as: "status", required: false },
            {
              model: Element, as: "Element", required: false,
              include: [{ model: ElemetModel, as: "element_model", required: false }],
            },
            { model: VocalNote,        as: "vocalNotes",        where: { type: "maintenance" }, required: false },
            { model: TextNote,         as: "textNotes",         where: { type: "maintenance" }, required: false },
            { model: PhotographicNote, as: "photographicNotes", where: { type: "maintenance" }, required: false },
          ],
        });

        const ml = job.maintenance_list;
        const elementModel = job.Element?.element_model;

        const modelIds = [
          elementModel?.id,
          ml?.System_ElementModel_ID,
          ml?.End_Item_ElementModel_ID,
          ml?.Maintenance_Item_ElementModel_ID,
        ].filter(Boolean);

        const spares = modelIds.length
          ? await Spare.findAll({ where: { element_model_id: modelIds } })
          : [];

        return {
          ...job.toJSON(),
          spares,
          computed_expiry_date: jobRaw.computed_expiry_date ?? null,
        };
      })
    );

    let result = enrichedJobs;
    if (filterRicambi) {
      result = enrichedJobs.filter(
        (job) => Array.isArray(job.spares) && job.spares.length > 0
      );
    }

    res.status(200).json({
      jobs: result,
      total: filtered.length,                              
      hasMore: offset + limitN < filtered.length,          
    });

  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: "Error fetching jobs" });
  }
};

exports.getJobsOnCondition = async (req, res) => {
  try {
    const { page = 1, limit = 30, eswbs_code } = req.query;
    const ship_id = req.shipAccess?.shipId;

    if (!ship_id) return res.status(400).json({ error: "Missing ship_id" });

    const offset = (Number(page) - 1) * Number(limit);
    const limitN  = Number(limit);

    let extraFilters = "";

    // ✅ filtro ESWBS (uguale al tuo)
    if (eswbs_code) {
      extraFilters += `
        AND (
          em.LCN LIKE '${eswbs_code}%'
          OR em_sys.LCN LIKE '${eswbs_code}%'
          OR em_end.LCN LIKE '${eswbs_code}%'
          OR em_maint.LCN LIKE '${eswbs_code}%'
        )
      `;
    }

    // 🔥 QUI LA DIFFERENZA
    const onConditionFilter = `
      AND je.recurrency_type_id IN (6, 13)
    `;

    const [rows] = await sequelize.query(`
      SELECT
        je.id,
        je.job_id,
        je.status_id,
        je.pauseDate,
        je.user_id,
        je.element_eswbs_instance_id,
        je.starting_date,
        je.ending_date,
        je.execution_date,
        je.recurrency_type_id,
        je.ship_id,
        je.execution_state,
        rt.delay_threshold,
        rt.due_threshold,
        rt.early_threshold

      FROM JobExecution je
      LEFT JOIN Maintenance ml ON ml.id = je.job_id
      LEFT JOIN RecurrencyType rt ON rt.id = je.recurrency_type_id
      LEFT JOIN Element e ON e.id = je.element_eswbs_instance_id
      LEFT JOIN ElementModel em ON em.id = e.element_model_id
      LEFT JOIN ElementModel em_sys   ON em_sys.id = ml.System_ElementModel_ID
      LEFT JOIN ElementModel em_end   ON em_end.id = ml.End_Item_ElementModel_ID
      LEFT JOIN ElementModel em_maint ON em_maint.id = ml.Maintenance_Item_ElementModel_ID

      WHERE je.ship_id = ${parseInt(ship_id)}
      ${onConditionFilter}
      ${extraFilters}
    `);

    // 🔥 puoi riusare la stessa logica enrichment
    const enrichedJobs = await Promise.all(
      rows.map(async (jobRaw) => {
        const job = await JobExecution.findOne({
          where: { id: jobRaw.id },
          include: [
            {
              model: Maintenance_List,
              as: "maintenance_list",
              required: false,
              include: [
                { model: maintenanceLevel, as: "maintenance_level", required: false },
                { model: recurrencyType,   as: "recurrency_type",   required: false },
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
              include: [
                { model: ElemetModel, as: "element_model", required: false },
              ],
            },
          ],
        });

        return job.toJSON();
      })
    );

    res.status(200).json({
      jobs: enrichedJobs,
      total: enrichedJobs.length,
      hasMore: false,
    });

  } catch (error) {
    console.error("Error fetching jobs on condition:", error);
    res.status(500).json({ error: "Error fetching jobs on condition" });
  }
};

exports.getFollowUpJobs = async (req, res) => {
  try {
    const { job_id } = req.query;
    const ship_id = req.shipAccess?.shipId;

    if (!job_id || !ship_id) {
      return res.status(400).json({ error: "Missing params" });
    }

    // 1️⃣ prendi il job padre
    const job = await JobExecution.findOne({
      where: { id: job_id },
      include: [
        {
          model: Maintenance_List,
          as: "maintenance_list",
        }
      ]
    });

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const fullName = job.maintenance_list.name.trim();
    const match = fullName.match(/\((.*?)\)/);
    const parentName = match ? match[1] : fullName;
    console.log("PARENT:", parentName);

    const [rows] = await sequelize.query(`
      SELECT 
        je.*,
        ml.name AS maintenance_name
      FROM JobExecution je
      JOIN Maintenance ml ON ml.id = je.job_id
      WHERE je.ship_id = ${parseInt(ship_id)}
      AND ml.name LIKE '%(${parentName})%'
    `);

    res.status(200).json({ jobs: rows });

  } catch (error) {
    console.error("Error fetching follow-up:", error);
    res.status(500).json({ error: "Error fetching follow-up" });
  }
};

exports.getTypes = async (req, res) => {
  try {
    const ship_id = req.shipAccess?.shipId;
    if (!ship_id) {
      return res.status(400).json({ error: "Missing ship_id" });
    }

    // 👉 1. prendi tutti i tipi TRANNE daily
    const types = await recurrencyType.findAll({
      where: {
        name: {
          [Op.ne]: "daily"
        }
      }
    });

    // 👉 2. prendi tutti i job UNA SOLA VOLTA
    const jobs = await JobExecution.findAll({
      where: { ship_id },
      attributes: [
        "recurrency_type_id",
        "execution_date",
        "ending_date"
      ]
    });

    // 👉 3. raggruppa per tipo
    const grouped = {};

    for (const job of jobs) {
      const typeId = job.recurrency_type_id;

      if (!grouped[typeId]) {
        grouped[typeId] = {
          count: 0,
          lastExecution: null,
          nextDue: null
        };
      }

      grouped[typeId].count++;

      // ultima esecuzione
      if (job.execution_date) {
        if (
          !grouped[typeId].lastExecution ||
          new Date(job.execution_date) > new Date(grouped[typeId].lastExecution)
        ) {
          grouped[typeId].lastExecution = job.execution_date;
        }
      }

      // prossima scadenza
      if (job.ending_date && new Date(job.ending_date) > new Date()) {
        if (
          !grouped[typeId].nextDue ||
          new Date(job.ending_date) < new Date(grouped[typeId].nextDue)
        ) {
          grouped[typeId].nextDue = job.ending_date;
        }
      }
    }

    // 👉 helper
    const getExpirationLabel = (name, dueDate) => {
      if (!dueDate) {
        const n = name.toLowerCase();

        if (n.includes("condition")) return "On condition";
        if (n.includes("fault")) return "On fault";

        return "No expiry";
      }

      return new Date(dueDate).toISOString();
    };

    const getStatusColor = (date) => {
      if (!date) return "gray";

      const today = new Date();
      const diff = Math.ceil((new Date(date) - today) / 86400000);

      if (diff < -15) return "red";
      if (diff < 0) return "orange";
      if (diff <= 3) return "yellow";
      if (diff > 15) return "green";

      return "gray";
    };

    // 👉 4. format finale
    const result = types.map((type) => {
      const data = grouped[type.id] || {};

      return {
        id: type.id,
        title: type.name,
        tasks: data.count || 0,
        lastExecution: data.lastExecution || null,
        dueDate: data.nextDue || null,
        expirationLabel: getExpirationLabel(type.name, data.nextDue),
        statusColor: getStatusColor(data.nextDue)
      };
    });

    return res.status(200).json({ maintenanceTypes: result });

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
            // ⭐ JOIN consumabili
            {
              model: Maintenance_ListConsumable,
              as: "maintenance_consumables",
              include: [{ model: Consumable, as: "consumable" }],
            },
            // ⭐ JOIN spare
            {
              model: Maintenance_ListSpare,
              as: "maintenance_spares",
              include: [{ model: Spare, as: "spare" }],
            },
            // ⭐ JOIN tools
            {
              model: Maintenance_ListTools,
              as: "maintenance_tools",
              include: [{ model: Tool, as: "tool" }],
            },
          ],
        },
        { model: recurrencyType, as: "recurrency_type" },
        { model: JobStatus, as: "status" },
        {
          model: Element,
          as: "Element",
          include: [{ model: ElemetModel, as: "element_model" }],
        },
      ],
    });

    const getSignedFileUrl = async (fileName, shipId) => {
      try {
        const prefix = `ships/${shipId}/`;
        const list = await s3.listObjectsV2({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
        }).promise();

        // Normalizza: lowercase, spazi → underscore, rimuovi estensione per il confronto
        const normalize = (str) =>
          str.toLowerCase()
            .replace(/\s+/g, "_")     // spazi → underscore
            .replace(/\.[^/.]+$/, ""); // rimuovi estensione

        const normalizedSearch = normalize(fileName);

        const found = list.Contents.find((obj) => {
          const keyName = obj.Key.split("/").pop(); // solo il filename, senza il path
          const normalizedKey = normalize(keyName);
          return normalizedKey.includes(normalizedSearch);
        });

        if (!found) {
          console.warn(`File non trovato su S3 per: "${fileName}" (normalizzato: "${normalizedSearch}")`);
          return null;
        }

        const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: found.Key });
        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      } catch (err) {
        console.error("Errore cercando file su S3:", err);
        return null;
      }
    };

    const enrichedJobs = await Promise.all(
      jobs.map(async (job) => {
        const jobJson = job.toJSON();

        // ⭐ Se Element è null, prova a recuperarlo dall'ElementModel della maintenance
        let element = jobJson.Element;

        if (!element) {
          const elementModelId = 
            jobJson.maintenance_list?.End_Item_ElementModel_ID ||
            jobJson.maintenance_list?.Maintenance_Item_ElementModel_ID ||
            jobJson.maintenance_list?.System_ElementModel_ID;

          if (elementModelId) {
            const foundElement = await Element.findOne({
              where: {
                element_model_id: elementModelId,
                ship_id: job.ship_id,
              },
              include: [{ model: ElemetModel, as: "element_model" }],
            });
            element = foundElement ? foundElement.toJSON() : null;
          }
        }

        // ⭐ Consumabili, spare, tools
        const consumables = (jobJson.maintenance_list?.maintenance_consumables || []).map((mc) => ({
          quantity: mc.Consumable_quantity,
          unit: mc.Consumable_quantity_Unit_of_measure,
          ...mc.consumable,
        }));

        const spares = (jobJson.maintenance_list?.maintenance_spares || []).map((ms) => ({
          quantity: ms.Spare_quantity,
          unit: ms.Spare_unit_of_measure,
          ...ms.spare,
        }));

        const tools = (jobJson.maintenance_list?.maintenance_tools || []).map((mt) => ({
          quantity: mt.Tool_quantity,
          unit: mt.Tool_Quantity_Unit_of_measure,
          ...mt.tool,
        }));

        // ⭐ PDF
        let documentFileUrl = null;
        const manualLink = jobJson.maintenance_list?.Service_or_Maintenance_Manual_Link;

        if (manualLink) {
          documentFileUrl = await getSignedFileUrl(manualLink, job.ship_id);
          const desiredPage = page || jobJson.maintenance_list?.Service_or_Maintenance_manual_ParagraphAndPage;
          if (documentFileUrl && desiredPage) {
            documentFileUrl = `${documentFileUrl}#page=${parseInt(desiredPage)}`;
          }
        }

        return {
          ...jobJson,
          Element: element,       // ⭐ sovrascrive null con quello trovato
          consumables,
          spares,
          tools,
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
    today.setUTCHours(0, 0, 0, 0)
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

    const jobExecution = await JobExecution.findByPk(jobExecutionId);

    if (!jobExecution) {
      return res.status(404).json({ error: "JobExecution not found" });
    }

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

    jobExecution.execution_state = mark;
    jobExecution.ending_date     = today;
    jobExecution.execution_date  = today;
    await jobExecution.save();

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

    if (jobExecution.user_id) {
      await createNotification({
        userId: jobExecution.user_id,
        shipId: jobExecution.ship_id,
        title: "Manutenzione completata",
        message: `La manutenzione ${jobExecution.job_id} è stata completata`,
        type: "maintenance_completed",
        entityType: "maintenance",
        entityId: jobExecution.id
      });
    }

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

