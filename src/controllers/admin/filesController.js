const { ShipFiles, User } = require("../../models");
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
require("dotenv").config();

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || "scia-project-questit";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const extractS3Key = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.startsWith("/") ? u.pathname.slice(1) : u.pathname);
  } catch {
    return null;
  }
};

exports.getProjectFiles = async (req, res) => {
  try {
    const { shipModelId } = req.params;

    const files = await ShipFiles.findAll({
      where: { ship_id: shipModelId },
      order: [["uploaded_at", "DESC"]]
    }); 
 
    const signedFiles = await Promise.all(
      files.map(async (file) => {
        let signedUrl = null; 
        const key = extractS3Key(file.file_link);

        if (key) {
          try {
            signedUrl = await getSignedUrl(
              s3Client,
              new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
              { expiresIn: 3600 }
            );
          } catch (err) {
            console.error("Signed URL error:", err);
            signedUrl = file.file_link;
          }
        }

        return {
          id: file.id,
          name: file.file_name,
          type: file.mime_type,
          uploadedAt: file.uploaded_at,
          uploadedBy: file.uploadedByUser
            ? `${file.uploadedByUser.first_name} ${file.uploadedByUser.last_name}`
            : "Sistema",
          url: signedUrl
        };
      })
    );

    res.json(signedFiles);
  } catch (err) {
    console.error("Errore getProjectFiles:", err);
    res.status(500).json({ error: "Errore recupero file progetto" });
  }
};

exports.uploadProjectFile = async (req, res) => {
  try {
    const { shipId } = req.params;
    const userId = req.body.userId;  // <-- 🔥 ora arriva dal formData
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Nessun file caricato" });
    if (!userId) return res.status(400).json({ error: "userId mancante" });

    const fileKey = `ships/${shipId}/${Date.now()}-${file.originalname}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    const newFile = await ShipFiles.create({
      ship_id: shipId,
      user_id: userId,
      file_link: `https://${BUCKET_NAME}.s3.amazonaws.com/${fileKey}`,
      file_name: file.originalname,
      file_type: file.mimetype,
    });

    res.status(201).json(newFile);
  } catch (err) {
    console.error("Errore upload:", err);
    res.status(500).json({ error: "Errore caricamento file" });
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await ShipFiles.findByPk(fileId);
    if (!file) return res.status(404).json({ error: "File non trovato" });

    const key = extractS3Key(file.file_path);

    if (key) {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key
        })
      );
    }

    await file.destroy();

    res.json({ success: true, message: "File eliminato con successo" });
  } catch (err) {
    console.error("Errore deleteFile:", err);
    res.status(500).json({ error: "Errore eliminazione file" });
  }
};
