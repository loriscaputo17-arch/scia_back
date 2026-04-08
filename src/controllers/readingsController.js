const { Readings, ReadingsType, Element, ElemetModel, sequelize } = require("../models");
const { Sequelize } = require("sequelize");
require('dotenv').config();
const AWS = require('aws-sdk');
const fs = require('fs');
const multer = require('multer');

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

exports.getReadings = async (req, res) => {
  try {
    const { ship_id, user_id } = req.query;

    if (!ship_id || !user_id) {
      return res.status(400).json({ error: "I parametri ship_id e user_id sono obbligatori." });
    }

    const [rows] = await sequelize.query(`
      SELECT
        r.id,
        r.user_id,
        r.ship_id,
        r.task_name,
        r.eswbs_id,
        r.recurrence,
        r.value,
        r.unit,
        r.due_date,
        r.description,
        r.tags,
        r.team,
        r.reading_type_id,
        r.element_id,

        rt.id         AS type_id,
        rt.name       AS type_name,

        e.id          AS element_id_join,
        e.name        AS element_name,
        e.serial_number,
        e.installation_date,
        e.progressive_code,
        e.element_model_id,

        em.id         AS model_id,
        em.ESWBS_code,
        em.LCN,
        em.LCNtype_ID,
        em.parent_element_model_id,

        s.id          AS ship_id_join,
        s.unit_name,
        s.unit_code,
        s.Side_ship_number

      FROM Readings r
      LEFT JOIN ReadingsType rt ON rt.id = r.reading_type_id
      LEFT JOIN ElementModel em ON em.id = (
        SELECT id FROM ElementModel
        WHERE ESWBS_code COLLATE utf8mb4_unicode_ci != ''
          AND ESWBS_code IS NOT NULL
          AND r.eswbs_id LIKE CONCAT(ESWBS_code COLLATE utf8mb4_unicode_ci, '%')
        ORDER BY LENGTH(ESWBS_code) DESC
        LIMIT 1
      )
      LEFT JOIN Element e ON e.id = (
        SELECT id FROM Element
        WHERE element_model_id = em.id
          AND ship_id = r.ship_id
        LIMIT 1
      )
      LEFT JOIN Ship    s ON s.id = r.ship_id
      WHERE r.ship_id = ${parseInt(ship_id)}
      ORDER BY CAST(r.recurrence AS SIGNED) ASC
    `);

    const readings = rows.map((r) => ({
      id:          r.id,
      user_id:     r.user_id,
      ship_id:     r.ship_id,
      task_name:   r.task_name,
      eswbs_id:    r.eswbs_id,
      recurrence:  r.recurrence,
      value:       r.value,
      unit:        r.unit,
      due_date:    r.due_date,
      description: r.description,
      tags:        r.tags,
      team:        r.team,

      type: r.type_id ? {
        id:   r.type_id,
        name: r.type_name,
      } : null,

      element: r.element_id_join ? {
        id:                r.element_id_join,
        name:              r.element_name,
        serial_number:     r.serial_number,
        installation_date: r.installation_date,
        progressive_code:  r.progressive_code,
        element_model_id:  r.element_model_id,
        element_model: r.model_id ? {
          id:                      r.model_id,
          ESWBS_code:              r.ESWBS_code,
          LCN:                     r.LCN,
          LCNtype_ID:              r.LCNtype_ID,
          parent_element_model_id: r.parent_element_model_id,
        } : null,
      } : null,

      ship: r.ship_id_join ? {
        id:               r.ship_id_join,
        unit_name:        r.unit_name,
        unit_code:        r.unit_code,
        side_ship_number: r.Side_ship_number,
      } : null,
    }));

    res.status(200).json(readings);

  } catch (error) {
    console.error("Errore nel recupero delle letture:", error);
    res.status(500).json({ error: "Errore nel recupero delle letture" });
  }
};

exports.getReading = async (req, res) => {
  try {
    const { id, page } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Il parametro id è obbligatorio." });
    }

    const [rows] = await sequelize.query(`
      SELECT
        r.id,
        r.user_id,
        r.ship_id,
        r.task_name,
        r.eswbs_id,
        r.recurrence,
        r.value,
        r.unit,
        r.due_date,
        r.description,
        r.tags,
        r.team,
        r.reading_type_id,
        r.element_id,

        rt.id         AS type_id,
        rt.name       AS type_name,

        e.id          AS element_id_join,
        e.name        AS element_name,
        e.serial_number,
        e.installation_date,
        e.progressive_code,
        e.element_model_id,

        em.id         AS model_id,
        em.ESWBS_code,
        em.LCN,
        em.LCNtype_ID,
        em.parent_element_model_id,

        s.id          AS ship_id_join,
        s.unit_name,
        s.unit_code,
        s.Side_ship_number

      FROM Readings r
      LEFT JOIN ReadingsType rt ON rt.id = r.reading_type_id
      LEFT JOIN ElementModel em ON em.id = (
        SELECT id FROM ElementModel
        WHERE ESWBS_code COLLATE utf8mb4_unicode_ci != ''
          AND ESWBS_code IS NOT NULL
          AND r.eswbs_id LIKE CONCAT(ESWBS_code COLLATE utf8mb4_unicode_ci, '%')
        ORDER BY LENGTH(ESWBS_code) DESC
        LIMIT 1
      )
      LEFT JOIN Element e ON e.id = (
        SELECT id FROM Element
        WHERE element_model_id = em.id
          AND ship_id = r.ship_id
        LIMIT 1
      )
      LEFT JOIN Ship s ON s.id = r.ship_id
      WHERE r.id = ${parseInt(id)}
    `);

    if (!rows.length) {
      return res.status(404).json({ error: "Lettura non trovata." });
    }

    const r = rows[0];

    // ── Signed URL per il documento S3 (description = nome file) ──────────
    const getSignedFileUrl = async (fileName, shipId) => {
      try {
        const prefix = `ships/${shipId}/`;
        const list = await s3.listObjectsV2({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
        }).promise();

        const normalize = (str) =>
          str.toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/\.[^/.]+$/, "");

        const normalizedSearch = normalize(fileName);

        const found = list.Contents.find((obj) => {
          const keyName = obj.Key.split("/").pop();
          const normalizedKey = normalize(keyName);
          return normalizedKey.includes(normalizedSearch);
        });

        if (!found) {
          console.warn(`File non trovato su S3: "${fileName}" (normalizzato: "${normalizedSearch}")`);
          return null;
        }

        const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: found.Key });
        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      } catch (err) {
        console.error("Errore cercando file su S3:", err);
        return null;
      }
    };

    let documentFileUrl = null;
    if (r.description && r.ship_id) {
      documentFileUrl = await getSignedFileUrl(r.description, r.ship_id);
      if (documentFileUrl && page) {
        documentFileUrl = `${documentFileUrl}#page=${parseInt(page)}`;
      }
    }

    const reading = {
      id:              r.id,
      user_id:         r.user_id,
      ship_id:         r.ship_id,
      task_name:       r.task_name,
      eswbs_id:        r.eswbs_id,
      recurrence:      r.recurrence,
      value:           r.value,
      unit:            r.unit,
      due_date:        r.due_date,
      description:     r.description,
      documentFileUrl, // ← URL firmato S3
      tags:            r.tags,
      team:            r.team,

      type: r.type_id ? {
        id:   r.type_id,
        name: r.type_name,
      } : null,

      element: r.element_id_join ? {
        id:                r.element_id_join,
        name:              r.element_name,
        serial_number:     r.serial_number,
        installation_date: r.installation_date,
        progressive_code:  r.progressive_code,
        element_model_id:  r.element_model_id,
        element_model: r.model_id ? {
          id:                      r.model_id,
          ESWBS_code:              r.ESWBS_code,
          LCN:                     r.LCN,
          LCNtype_ID:              r.LCNtype_ID,
          parent_element_model_id: r.parent_element_model_id,
        } : null,
      } : null,

      ship: r.ship_id_join ? {
        id:               r.ship_id_join,
        unit_name:        r.unit_name,
        unit_code:        r.unit_code,
        side_ship_number: r.Side_ship_number,
      } : null,
    };

    res.status(200).json(reading);

  } catch (error) {
    console.error("Errore nel recupero della lettura:", error);
    res.status(500).json({ error: "Errore nel recupero della lettura" });
  }
};

exports.updateReading = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    if (!id) {
      return res.status(400).json({ error: "Parametro 'id' mancante." });
    }

    const [updated] = await Readings.update(updatedData, {
      where: { id }
    });

    if (updated === 0) {
      return res.status(404).json({ error: "Lettura non trovata o nessuna modifica effettuata." });
    }

    const updatedReading = await Readings.findOne({
      where: { id }
    });

    res.status(200).json(updatedReading);
  } catch (error) {
    console.error("Errore nell'aggiornamento della lettura:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento della lettura." });
  }
};

