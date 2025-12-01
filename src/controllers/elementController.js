const { Organizations } = require("aws-sdk");
const { Element, ElemetModel, Ship, Spare, JobExecution, 
  VocalNote, TextNote, PhotographicNote, Parts, OrganizationCompanyNCAGE, User } = require("../models");

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

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

exports.getElement = async (req, res) => {
  try {
    const { element, ship_id } = req.body;

    if (!element || !ship_id) {
      return res.status(400).json({ error: "Missing element or ship_id in request body" });
    }

    console.log("Serial Number:", element);
    console.log("Ship:", ship_id);

    // 1️⃣ Trova l'elemento tramite serial_number
    const elementData = await Element.findOne({
      where: {
        serial_number: element,
        ship_id: ship_id
      },
      raw: true,
    });

    if (!elementData) {
      return res.status(404).json({ error: "Element not found" });
    }

    // 2️⃣ Recupera il modello collegato
    const elementModel = await ElemetModel.findOne({
      where: { id: elementData.element_model_id },
      raw: true,
    });

    if (!elementModel) {
      return res.status(404).json({ error: "Element model not found" });
    }

    // 3️⃣ Ricambi collegati al modello
    const spares = await Spare.findAll({
      where: { element_model_id: elementModel.id },
      raw: true,
    });

    const jobExecutions = await JobExecution.findAll({
      where: { element_eswbs_instance_id: elementData.id },
      raw: true,
    });

    const jobExecutionIds = jobExecutions.map(job => job.id);

    const [vocalNotesRaw, textNotesRaw, photographyNotesRaw] = await Promise.all([
      VocalNote.findAll({ where: { task_id: jobExecutionIds }, raw: true }),
      TextNote.findAll({ where: { task_id: jobExecutionIds }, raw: true }),
      PhotographicNote.findAll({ where: { task_id: jobExecutionIds }, raw: true }),
    ]);

    const vocalNotes = await Promise.all(
      vocalNotesRaw.map(async note => {
        const key = extractS3Key(note.audio_url);
        if (key) {
          note.audio_url = await getSignedUrl(
            s3Client,
            new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
            { expiresIn: 3600 }
          );
        }
        return note;
      })
    );

    const photographyNotes = await Promise.all(
      photographyNotesRaw.map(async note => {
        const key = extractS3Key(note.image_url);
        if (key) {
          note.image_url = await getSignedUrl(
            s3Client,
            new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
            { expiresIn: 3600 }
          );
        }
        return note;
      })
    );

    const author =
      vocalNotes.length > 0 && vocalNotes[0].author
        ? await User.findOne({ where: { id: vocalNotes[0].author }, raw: true })
        : null;

    // 8️⃣ Parts + Organization
    const parts = elementModel.Manufacturer_ID
      ? await Parts.findOne({ where: { ID: elementModel.Manufacturer_ID }, raw: true })
      : null;

    const organization =
      parts?.OrganizationCompanyNCAGE_ID
        ? await OrganizationCompanyNCAGE.findOne({
            where: { ID: parts.OrganizationCompanyNCAGE_ID },
            raw: true,
          })
        : null;

    // 9️⃣ Risposta finale
    return res.status(200).json({
      element: elementData,
      model: elementModel,
      spares,
      jobExecutions,
      parts,
      organization,
      notes: {
        vocal: vocalNotes,
        text: textNotesRaw,
        photos: photographyNotes,
        author,
      },
    });

  } catch (error) {
    console.error("Error retrieving element with related data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.addElementTimeWork = async (req, res) => {
  const { id, time } = req.body;

  try {
    const element = await Element.findByPk(id);
    if (!element) {
      return res.status(404).json({ error: "Element not found" });
    }

    element.time_to_work = time; 
    element.updated_at = new Date(); 
    await element.save();

    res.status(200).json({ message: "Element timeWork updated", element });
  } catch (error) {
    console.error("Error updating element timeWork:", error);
    res.status(500).json({ error: "Error updating element timeWork" });
  }
};


exports.updateElement = async (req, res) => {
  const { id } = req.params;
  try {
    const [updatedRows] = await Element.update(req.body, {
      where: { id },
    });

    if (updatedRows === 0) {
      return res.status(404).json({ error: "Element not found" });
    }

    res.json({ message: "Element successfully updated" });
  } catch (error) {
    console.error("Error updating element:", error);
    res.status(500).json({ error: "Error updating element" });
  }
};

exports.getElements = async (req, res) => {
  const { ship_model_id } = req.params;
  const { teamId } = req.body;

  try {
    const ship = await Ship.findOne({
      where: { id: ship_model_id, team: teamId },
    });

    if (!ship) return res.status(404).json({ error: "Ship not found" });

    const flatElements = await Element.findAll({
      where: { ship_id: ship.id },
      include: [
        {
          model: ElemetModel,
          as: "element_model"
        },
      ],
    });


    if (!flatElements.length)
      return res.status(404).json({ error: "No elements found" });

    console.log(flatElements[0].element_model.ESWBS_code)

    const tree = flatElements.map(el => ({
      id: el.id.toString(),
      name: el.name,
      code: el.serial_number,
      eswbs_code: el.element_model.ESWBS_code,
      children: [] // no parent data → flat structure
    }));

    return res.status(200).json(tree);

  } catch (error) {
    console.error("Error retrieving elements:", error);
    return res.status(500).json({ error: "Server error while retrieving elements" });
  }
};


