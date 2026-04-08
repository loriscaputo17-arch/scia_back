const { ShipFiles } = require('../models');
const { 
  S3Client, 
  GetObjectCommand, 
  PutObjectCommand 
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require("multer");
const path = require("path");

const upload = multer({ storage: multer.memoryStorage() });

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = 'scia-project-questit';

const extractS3Key = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname);
  } catch (e) {
    return null;
  }
};

exports.getFiles = async (req, res) => {
  try {
    const { ship_id, user_id, search, file_type } = req.query;

    if (!ship_id) {
      return res.status(400).json({ error: "ship_id è obbligatorio" });
    }

    // 🔧 WHERE dinamico
    const where = { ship_id };

    if (file_type) {
      where.file_type = file_type;
    }

    if (search) {
      where.file_name = {
        [Op.like]: `%${search}%`,
      };
    }

    const files = await ShipFiles.findAll({
      where,
      order: [["uploaded_at", "DESC"]],
    });

    const signedFiles = await Promise.all(
      files.map(async (file) => {
        let signedUrl = file.file_link;

        try {
          const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: file.file_link, // ✅ FIX
          });

          signedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: 3600,
          });
        } catch (err) {
          console.warn("Errore signed URL:", err);
        }

        return {
          ...file.toJSON(),
          file_link: signedUrl, // 👈 ora è URL valido
        };
      })
    );

    return res.status(200).json({
      files: signedFiles,
      total: signedFiles.length,
    });

  } catch (error) {
    console.error("Errore nel recupero dei file:", error);
    return res.status(500).json({
      error: "Errore nel recupero dei file",
    });
  }
};

// 👉 middleware multer
exports.uploadMiddleware = upload.single("file");

// controller/shipFilesController.js

// ── Crea cartella ──────────────────────────────────────
exports.createFolder = async (req, res) => {
  try {
    const { ship_id, user_id, folder_name, parent_folder_id } = req.body;

    if (!ship_id || !user_id || !folder_name) {
      return res.status(400).json({ error: "ship_id, user_id e folder_name obbligatori" });
    }

    const folder = await ShipFiles.create({
      ship_id:          Number(ship_id),
      user_id:          Number(user_id),
      file_name:        folder_name,
      file_link:        "",
      file_type:        null,
      is_folder:        1,
      parent_folder_id: parent_folder_id ? Number(parent_folder_id) : null,
      uploaded_at:      new Date(),
    });

    return res.status(200).json({ message: "Cartella creata", folder });
  } catch (error) {
    console.error("Errore creazione cartella:", error);
    return res.status(500).json({ error: "Errore creazione cartella" });
  }
};

// ── Upload file (aggiornato con parent_folder_id) ──────
exports.uploadShipFile = async (req, res) => {
  try {
    const { ship_id, user_id, description, parent_folder_id } = req.body;
    const file = req.file;

    if (!file || !ship_id || !user_id) {
      return res.status(400).json({ error: "file, ship_id e user_id obbligatori" });
    }

    const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
    const key = `ships/${ship_id}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await s3Client.send(command);

    const newFile = await ShipFiles.create({
      ship_id:          Number(ship_id),
      user_id:          Number(user_id),
      file_link:        key,
      file_name:        file.originalname,
      file_type:        file.mimetype,
      description:      description || null,
      is_folder:        0,
      parent_folder_id: parent_folder_id ? Number(parent_folder_id) : null,
      uploaded_at:      new Date(),
    });

    return res.status(200).json({ message: "File caricato", file: newFile });
  } catch (error) {
    console.error("Errore upload:", error);
    return res.status(500).json({ error: "Errore upload" });
  }
};

// ── Albero file/cartelle per nave ──────────────────────
exports.getFileTree = async (req, res) => {
  try {
    const { ship_id } = req.params;

    const all = await ShipFiles.findAll({
      where: { ship_id },
      order: [["is_folder", "DESC"], ["file_name", "ASC"]],
    });

    // Firma URL per tutti i file non-cartella
    const signedItems = await Promise.all(
      all.map(async (item) => {
        const json = item.toJSON();

        if (!json.is_folder && json.file_link) {
          try {
            const command = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: json.file_link,
            });

            json.file_link = await getSignedUrl(s3Client, command, {
              expiresIn: 3600,
            });
          } catch (err) {
            console.warn("Errore signed URL tree:", err);
          }
        }

        return json;
      })
    );

    const buildTree = (items, parentId = null) =>
      items
        .filter((f) => {
          const fParent = f.parent_folder_id != null ? Number(f.parent_folder_id) : null;
          const target = parentId != null ? Number(parentId) : null;
          return fParent === target;
        })
        .map((f) => ({
          ...f,
          children: f.is_folder ? buildTree(items, f.id) : [],
        }));

    return res.status(200).json(buildTree(signedItems));

  } catch (error) {
    console.error("Errore fetch tree:", error);
    return res.status(500).json({ error: "Errore fetch tree" });
  }
};