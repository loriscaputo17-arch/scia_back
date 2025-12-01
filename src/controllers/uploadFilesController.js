require('dotenv').config();

const { User, PhotographicNote, TextNote, VocalNote } = require("../models");
const AWS = require('aws-sdk');
const multer = require('multer');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const BUCKET_NAME = 'scia-project-questit';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
exports.upload = upload;

exports.uploadPhoto = async (req, res) => {
  const { failureId, authorId, type } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No photo uploaded" });
  }

  const fileName = `shipsFiles/${Date.now()}_${failureId}_${file.originalname}`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    // ACL rimosso perché il bucket è privato
  };

  try {
    await s3.upload(params).promise();

    const newNote = await PhotographicNote.create({
      failure_id: failureId,
      image_url: fileName, // Salviamo solo la Key
      created_at: new Date(),
      author: authorId,
      type: type
    });

    res.status(201).json({
      message: "Nota fotografica caricata con successo",
      note: newNote,
    });
  } catch (error) {
    console.error("Errore upload foto:", error);
    res.status(500).json({ error: "Errore nel caricamento della nota fotografica" });
  }
};

exports.getPhotos = async (req, res) => {
  try {
    const { failureId, type } = req.params;

    if (!failureId || !type) {
      return res.status(400).json({ error: "failureId e type sono obbligatori" });
    }

    const photos = await PhotographicNote.findAll({
      where: { failure_id: failureId, type: type },
      include: [
        {
          model: User,
          as: 'authorDetails',
        }
      ],
    });

    const signedPhotos = await Promise.all(photos.map(async (photo) => {
      const key = photo.image_url; // è già la key S3 salvata

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 ora

      return {
        ...photo.toJSON(),
        signedUrl,
      };
    }));

    res.status(200).json({
      message: "Note fotografiche recuperate con successo",
      notes: signedPhotos,
    });
  } catch (error) {
    console.error("Errore nel recupero delle note fotografiche:", error);
    res.status(500).json({ error: "Errore nel recupero delle note fotografiche" });
  }
};


exports.uploadAudio = async (req, res) => {
  const { failureId, authorId, type } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No audio uploaded" });
  }

  const fileName = `shipsFiles/${Date.now()}_${failureId}_${file.originalname}`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    const uploadResult = await s3.upload(params).promise();
    const audioUrl = uploadResult.Location;

    const newNote = await VocalNote.create({
      failure_id: failureId,
      audio_url: audioUrl,
      created_at: new Date(),
      author: authorId,
      type: type
    });

    res.status(201).json({
      message: "Nota vocale caricata con successo",
      note: newNote,
    });
  } catch (error) {
    console.error("Errore upload audio:", error);
    res.status(500).json({ error: "Errore nel caricamento della nota vocale" });
  }
};

exports.uploadTextNote = async (req, res) => {
  try {
    const { failureId, content, authorId, type } = req.body;

    if (!failureId || !content) {
      return res.status(400).json({ error: "failureId e content sono obbligatori" });
    }

    const newTextNote = await TextNote.create({
      //failure_id: failureId,
      text_field: content,
      task_id: failureId,
      author: authorId,
      type: type
    });

    res.status(201).json({
      message: "Nota testuale salvata con successo",
      note: newTextNote,
    });
  } catch (error) {
    console.error("Errore nel salvataggio della nota testuale:", error);
    res.status(500).json({ error: "Errore nel salvataggio della nota testuale" });
  }
};

exports.getAudios = async (req, res) => {
  try {
    const { failureId, type } = req.params;

    if (!failureId) {
      return res.status(400).json({ error: "failureId è obbligatorio" });
    }

    const audios = await VocalNote.findAll({
      where: { failure_id: failureId, type: type },
      include: [
        {
          model: User,
          as: 'authorDetails',
        }
      ],
    });

    res.status(200).json({
      message: "Note vocali recuperate con successo",
      notes: audios,
    });
  } catch (error) {
    console.error("Errore nel recupero delle note vocali:", error);
    res.status(500).json({ error: "Errore nel recupero delle note vocali" });
  }
};

exports.getTextNotes = async (req, res) => {
  try {
    const { failureId, type } = req.params;

    if (!failureId) {
      return res.status(400).json({ error: "failureId è obbligatorio" });
    }

    const texts = await TextNote.findAll({
      where: { failure_id: failureId, type: type },
      include: [
        {
          model: User,
          as: 'authorDetails',
        }
      ],
    });

    res.status(200).json({
      message: "Note testuali recuperate con successo",
      notes: texts,
    });
  } catch (error) {
    console.error("Errore nel recupero delle note testuali:", error);
    res.status(500).json({ error: "Errore nel recupero delle note testuali" });
  }
};

exports.uploadPhotoGeneral = async (req, res) => {
  const { failureId, authorId, type, status } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No photo uploaded" });
  }

  const fileName = `shipsFiles/${Date.now()}_${failureId}_${file.originalname}`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    const uploadResult = await s3.upload(params).promise();
    const photoUrl = uploadResult.Location;

    const newNote = await PhotographicNote.create({
      task_id: failureId,
      image_url: photoUrl,
      created_at: new Date(),
      author: authorId,
      type: type,
      status: status,
    });

    res.status(201).json({
      message: "Nota fotografica caricata con successo",
      note: newNote,
    });
  } catch (error) {
    console.error("Errore upload foto:", error);
    res.status(500).json({ error: "Errore nel caricamento della nota fotografica" });
  }
};

exports.uploadAudioGeneral = async (req, res) => {
  const { failureId, authorId, type, status } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No audio uploaded" });
  }

  const fileName = `shipsFiles/${Date.now()}_${failureId}_${file.originalname}`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    const uploadResult = await s3.upload(params).promise();
    const audioUrl = uploadResult.Location;

    const newNote = await VocalNote.create({
      task_id: failureId,
      audio_url: audioUrl,
      created_at: new Date(),
      author: authorId,
      type: type,
      status: status
    });

    res.status(201).json({
      message: "Nota vocale caricata con successo",
      note: newNote,
    });
  } catch (error) {
    console.error("Errore upload audio:", error);
    res.status(500).json({ error: "Errore nel caricamento della nota vocale" });
  }
};

exports.uploadTextNoteGeneral = async (req, res) => {
  try {
    const { failureId, content, authorId, type, status } = req.body;

    if (!failureId || !content) {
      return res.status(400).json({ error: "failureId e content sono obbligatori" });
    }

    const newTextNote = await TextNote.create({
      task_id: failureId,
      text_field: content,
      author: authorId,
      type: type,
      status: status
    });

    res.status(201).json({
      message: "Nota testuale salvata con successo",
      note: newTextNote,
    });
  } catch (error) {
    console.error("Errore nel salvataggio della nota testuale:", error);
    res.status(500).json({ error: "Errore nel salvataggio della nota testuale" });
  }
};

exports.getAudiosGeneral = async (req, res) => {
  try {
    const { failureId, type } = req.params;

    if (!failureId) {
      return res.status(400).json({ error: "failureId è obbligatorio" });
    }

    const audios = await VocalNote.findAll({
      where: { task_id: failureId, type: type },
      include: [
        {
          model: User,
          as: 'authorDetails',
        }
      ],
    });

      const extractS3Key = (url) => {
        if (!url) return null;
        try {
          const u = new URL(url);
          // DECODIFICA completamente il path per ottenere il vero nome del file
          return decodeURIComponent(u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname);
        } catch (e) {
          return null;
        }
      };

    const signedAudios = await Promise.all(
      audios.map(async (audio) => {
        let signedAudioUrl = null;

        if (audio.audio_url) {
          const key = extractS3Key(audio.audio_url);

          if (key) {
            const command = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
            });

            try {
              signedAudioUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            } catch (err) {
              console.warn("Errore generando signed URL per audio_url:", err);
              signedAudioUrl = audio.audio_url; // fallback
            }
          }
        }

        return {
          ...audio.toJSON(),
          audio_url: signedAudioUrl,
        };
      })
    );

    res.status(200).json({
      message: "Note vocali recuperate con successo",
      notes: signedAudios,
    });

  } catch (error) {
    console.error("Errore nel recupero delle note vocali:", error);
    res.status(500).json({ error: "Errore nel recupero delle note vocali" });
  }
};

exports.getTextNotesGeneral = async (req, res) => {
  try {
    const { failureId, type } = req.params;

    if (!failureId) {
      return res.status(400).json({ error: "failureId è obbligatorio" });
    }

    const texts = await TextNote.findAll({
      where: { task_id: failureId, type: type },
      include: [
        {
          model: User,
          as: 'authorDetails',
        }
      ],
    });

    res.status(200).json({
      message: "Note testuali recuperate con successo",
      notes: texts,
    });
  } catch (error) {
    console.error("Errore nel recupero delle note testuali:", error);
    res.status(500).json({ error: "Errore nel recupero delle note testuali" });
  }
};

exports.getPhotosGeneral = async (req, res) => {
  try {
    const { failureId, type } = req.params;

    if (!failureId) {
      return res.status(400).json({ error: "failureId è obbligatorio" });
    }

    const photos = await PhotographicNote.findAll({
      where: { task_id: failureId, type },
      include: [
        {
          model: User,
          as: 'authorDetails',
        }
      ],
    });

    const extractS3Key = (url) => {
      if (!url) return null;
      try {
        const u = new URL(url);
        return decodeURIComponent(u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname);
      } catch (e) {
        return null;
      }
    };

    const signedPhotos = await Promise.all(
      photos.map(async (photo) => {
        let signedPhotoUrl = null;

        if (photo.image_url) {
          const key = extractS3Key(photo.image_url);

          if (key) {
            const command = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
            });

            try {
              signedPhotoUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            } catch (err) {
              console.warn("Errore generando signed URL per image_url:", err);
              signedPhotoUrl = photo.image_url;
            }
          }
        }

        return {
          ...photo.toJSON(),
          image_url: signedPhotoUrl,
        };
      })
    );

    res.status(200).json({
      message: "Note fotografiche recuperate con successo",
      notes: signedPhotos,
    });
  } catch (error) {
    console.error("Errore nel recupero delle note fotografiche:", error);
    res.status(500).json({ error: "Errore nel recupero delle note fotografiche" });
  }
};
