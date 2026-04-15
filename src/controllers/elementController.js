const { Organizations } = require("aws-sdk");
const { Element, ElemetModel, Ship, Spare, JobExecution, 
  VocalNote, TextNote, PhotographicNote, Parts, OrganizationCompanyNCAGE, User,
  Maintenance_List, maintenanceLevel, recurrencyType,
  JobStatus, Failures, Readings, ReadingsType, Scans, ShipFiles } = require("../models");

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Op, Sequelize } = require("sequelize");

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

    // 1️⃣ Trova l'elemento
    const elementData = await Element.findOne({
      where: { id: element, ship_id },
      raw: true,
    });

    if (!elementData) return res.status(404).json({ error: "Element not found" });

    // 2️⃣ ElementModel
    const elementModel = await ElemetModel.findOne({
      where: { id: elementData.element_model_id },
      raw: true,
    });

    if (!elementModel) return res.status(404).json({ error: "Element model not found" });

    // 3️⃣ Elementi figli (stesso parent_element_model_id = elementModel.id)
    const childModels = await ElemetModel.findAll({
      where: { parent_element_model_id: elementModel.id },
      raw: true,
    });

    const childModelIds = childModels.map(m => m.id);

    const childElements = childModelIds.length
      ? await Element.findAll({
          where: {
            element_model_id: { [Op.in]: childModelIds },
            ship_id,
          },
          raw: true,
        })
      : [];

    // 4️⃣ Elemento padre
    let parentElement = null;
    let parentModel = null;
    if (elementModel.parent_element_model_id && elementModel.parent_element_model_id !== 0) {
      parentModel = await ElemetModel.findOne({
        where: { id: elementModel.parent_element_model_id },
        raw: true,
      });
      if (parentModel) {
        parentElement = await Element.findOne({
          where: { element_model_id: parentModel.id, ship_id },
          raw: true,
        });
      }
    }

    // 5️⃣ Ricambi collegati al modello
    const spares = await Spare.findAll({
      where: { element_model_id: elementModel.id },
      include: [
        {
          model: Parts,
          as: "part",
          include: [{ model: OrganizationCompanyNCAGE, as: "organizationCompanyNCAGE" }],
        },
      ],
    });

    // 6️⃣ Manutenzioni collegate
    const maintenances = await Maintenance_List.findAll({
      where: {
        id_ship: ship_id,
        [Op.or]: [
          { End_Item_ElementModel_ID: elementModel.id },
          { Maintenance_Item_ElementModel_ID: elementModel.id },
          { System_ElementModel_ID: elementModel.id },
        ],
      },
      include: [
        { model: maintenanceLevel, as: "maintenance_level" },
        { model: recurrencyType, as: "recurrency_type" },
      ],
    });

    // 7️⃣ Job executions collegati all'elemento
    const jobExecutions = await JobExecution.findAll({
      where: { element_eswbs_instance_id: elementData.id },
      include: [
        { model: JobStatus, as: "status" },
        { model: recurrencyType, as: "recurrency_type" },
      ],
      order: [["ending_date", "DESC"]],
      limit: 20,
    });

    const jobExecutionIds = jobExecutions.map(job => job.id);

    // 8️⃣ Note
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

    // 9️⃣ Failures collegati all'elemento
    const failures = await Failures.findAll({
      where: { ship_id },
      raw: true,
    });

    // 🔟 Readings collegati all'elemento
    const readings = await Readings.findAll({
      where: { element_id: elementData.id },
      include: [{ model: ReadingsType, as: "type" }],
      order: [["due_date", "DESC"]],
      limit: 50,
    });

    // 1️⃣1️⃣ Scansioni
    const scans = await Scans.findAll({
      where: { element_id: elementData.id },
      order: [["scanned_at", "DESC"]],
      limit: 10,
      raw: true,
    });

    // 1️⃣2️⃣ Parts + Organization del produttore
    const parts_manufacturer = elementModel.Manufacturer_ID
      ? await Parts.findOne({
          where: { ID: elementModel.Manufacturer_ID },
          include: [{ model: OrganizationCompanyNCAGE, as: "organizationCompanyNCAGE" }],
        })
      : null;

    // 1️⃣3️⃣ Supplier
    const supplier = elementModel.Supplier_ID
      ? await OrganizationCompanyNCAGE.findOne({
          where: { ID: elementModel.Supplier_ID },
          raw: true,
        })
      : null;

    // 1️⃣4️⃣ Ship files collegati alla ship
    const shipFiles = await ShipFiles.findAll({
      where: { ship_id },
      raw: true,
    });

    // 1️⃣5️⃣ Autori note
    const authorIds = [
      ...new Set([
        ...vocalNotesRaw.map(n => n.author),
        ...textNotesRaw.map(n => n.author),
        ...photographyNotesRaw.map(n => n.author),
      ].filter(Boolean))
    ];

    const authors = authorIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: authorIds } },
          attributes: ["id", "first_name", "last_name"],
          raw: true,
        })
      : [];

    const authorMap = {};
    authors.forEach(a => { authorMap[a.id] = a; });

    // Arricchisci note con autori
    const enrichNote = (note) => ({
      ...note,
      authorDetails: authorMap[note.author] || null,
    });

    return res.status(200).json({
      element: elementData,
      model: elementModel,

      // Gerarchia
      parent: parentElement ? { element: parentElement, model: parentModel } : null,
      children: childElements.map(ce => ({
        element: ce,
        model: childModels.find(m => m.id === ce.element_model_id) || null,
      })),

      // Ricambi
      spares: spares.map(s => s.toJSON()),

      // Manutenzioni
      maintenances: maintenances.map(m => m.toJSON()),

      // Job executions recenti
      jobExecutions: jobExecutions.map(j => j.toJSON()),

      // Readings
      readings: readings.map(r => r.toJSON()),

      // Scansioni
      scans,

      // Failures
      failures,

      // Files nave
      shipFiles,

      // Produttore / Fornitore
      manufacturer: parts_manufacturer ? parts_manufacturer.toJSON() : null,
      supplier,

      // Note
      notes: {
        vocal: vocalNotes.map(enrichNote),
        text: textNotesRaw.map(enrichNote),
        photos: photographyNotes.map(enrichNote),
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
  const { teamId, lcnTypes } = req.body;

  try {
    const shipWhere = { id: ship_model_id };
    if (teamId) shipWhere.team = teamId;

    const ship = await Ship.findOne({ where: shipWhere });
    if (!ship) return res.status(404).json({ error: "Ship not found" });

    const flatElements = await Element.findAll({
      where: {
        ship_id: ship.id,
        element_model_id: { [Op.ne]: null },
      },
      include: [
        {
          model: ElemetModel, // ✅ fix typo
          as: "element_model",
          attributes: [
            "id",
            "parent_element_model_id",
            "ESWBS_code",
            "LCNtype_ID",
          ],
          where: {
            ...(lcnTypes?.length && {
              LCNtype_ID: { [Op.in]: lcnTypes },
            }),

            // 🔥 filtro ESWBS (NO finali con 0)
            ESWBS_code: {
              [Op.notLike]: "%0",
            },
          },
          required: true,
        },
      ],
    });

    if (!flatElements.length)
      return res.status(404).json({ error: "No elements found" });

    const map = {};
    flatElements.forEach((el) => {
      map[el.id] = {
        id: el.id.toString(),
        name: el.name,
        code: el.serial_number,
        LCNtype_ID: el.element_model?.LCNtype_ID,
        eswbs_code: el.element_model?.ESWBS_code,
        element_model_id: el.element_model?.id,
        parent_element_model_id:
          el.element_model?.parent_element_model_id,
        children: [],
      };
    });

    const modelIdMap = {};
    flatElements.forEach((el) => {
      if (el.element_model)
        modelIdMap[el.element_model.id] = map[el.id];
    });

    const tree = [];
    Object.values(map).forEach((node) => {
      const parentNode = modelIdMap[node.parent_element_model_id];
      if (parentNode && parentNode.id !== node.id) {
        parentNode.children.push(node);
      } else {
        tree.push(node);
      }
    });

    return res.status(200).json(tree);
  } catch (error) {
    console.error("Error retrieving elements:", error);
    return res.status(500).json({
      error: "Server error while retrieving elements",
    });
  }
};