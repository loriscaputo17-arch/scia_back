// ─── IMPORTS ────────────────────────────────────────────────────────────────
const { Organizations } = require("aws-sdk");
const { Element, ElemetModel, Ship, Spare, JobExecution,
  VocalNote, TextNote, PhotographicNote, Parts, OrganizationCompanyNCAGE, User,
  Maintenance_List, maintenanceLevel, recurrencyType,
  JobStatus, Failures, Readings, ReadingsType, Scans, ShipFiles } = require("../models");

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Op, Sequelize } = require("sequelize");
const ExcelJS = require("exceljs"); // ✅ spostato in cima con gli altri require

// ─── S3 ──────────────────────────────────────────────────────────────────────
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

// ─── HELPER PRIVATO: split descrizione in ≤4 campi da max 25 caratteri ──────
function splitDescription(name, maxChars = 25, maxFields = 4) {
  if (!name) return ["", "", "", ""];

  const words = name.trim().toUpperCase().split(/\s+/);
  const fields = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length <= maxChars) {
      current = test;
    } else {
      if (current) fields.push(current);
      if (fields.length === maxFields) break;
      current = word;
    }
  }

  if (current && fields.length < maxFields) fields.push(current);

  const usedWordCount = fields.reduce((acc, f) => acc + f.split(/\s+/).length, 0);
  const remainingWords = words.slice(usedWordCount);

  if (remainingWords.length > 0 && fields.length === maxFields) {
    let last = fields[fields.length - 1];
    for (const w of remainingWords) {
      const attempt = `${last} ${w}`;
      if (attempt.length <= maxChars - 1) {
        last = attempt;
      } else {
        const available = maxChars - 1 - last.length - 1;
        if (available > 0) {
          last = `${last} ${w.slice(0, available)}-`;
        } else {
          last = `${last.slice(0, maxChars - 1)}-`;
        }
        break;
      }
    }
    fields[fields.length - 1] = last;
  }

  while (fields.length < maxFields) fields.push("");
  return fields.slice(0, maxFields);
}

// ─── CONTROLLERS ─────────────────────────────────────────────────────────────

exports.getElement = async (req, res) => {
  try {
    const { element, ship_id } = req.body;

    if (!element || !ship_id) {
      return res.status(400).json({ error: "Missing element or ship_id in request body" });
    }

    const elementData = await Element.findOne({
      where: { id: element, ship_id },
      raw: true,
    });

    if (!elementData) return res.status(404).json({ error: "Element not found" });

    const elementModel = await ElemetModel.findOne({
      where: { id: elementData.element_model_id },
      raw: true,
    });

    if (!elementModel) return res.status(404).json({ error: "Element model not found" });

    const childModels = await ElemetModel.findAll({
      where: { parent_element_model_id: elementModel.id },
      raw: true,
    });

    const childModelIds = childModels.map(m => m.id);

    const childElements = childModelIds.length
      ? await Element.findAll({
          where: { element_model_id: { [Op.in]: childModelIds }, ship_id },
          raw: true,
        })
      : [];

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

    const failures = await Failures.findAll({ where: { ship_id }, raw: true });

    const readings = await Readings.findAll({
      where: { element_id: elementData.id },
      include: [{ model: ReadingsType, as: "type" }],
      order: [["due_date", "DESC"]],
      limit: 50,
    });

    const scans = await Scans.findAll({
      where: { element_id: elementData.id },
      order: [["scanned_at", "DESC"]],
      limit: 10,
      raw: true,
    });

    const parts_manufacturer = elementModel.Manufacturer_ID
      ? await Parts.findOne({
          where: { ID: elementModel.Manufacturer_ID },
          include: [{ model: OrganizationCompanyNCAGE, as: "organizationCompanyNCAGE" }],
        })
      : null;

    const supplier = elementModel.Supplier_ID
      ? await OrganizationCompanyNCAGE.findOne({
          where: { ID: elementModel.Supplier_ID },
          raw: true,
        })
      : null;

    const shipFiles = await ShipFiles.findAll({ where: { ship_id }, raw: true });

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

    const enrichNote = (note) => ({ ...note, authorDetails: authorMap[note.author] || null });

    return res.status(200).json({
      element: elementData,
      model: elementModel,
      parent: parentElement ? { element: parentElement, model: parentModel } : null,
      children: childElements.map(ce => ({
        element: ce,
        model: childModels.find(m => m.id === ce.element_model_id) || null,
      })),
      spares: spares.map(s => s.toJSON()),
      maintenances: maintenances.map(m => m.toJSON()),
      jobExecutions: jobExecutions.map(j => j.toJSON()),
      readings: readings.map(r => r.toJSON()),
      scans,
      failures,
      shipFiles,
      manufacturer: parts_manufacturer ? parts_manufacturer.toJSON() : null,
      supplier,
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
    if (!element) return res.status(404).json({ error: "Element not found" });
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
    const [updatedRows] = await Element.update(req.body, { where: { id } });
    if (updatedRows === 0) return res.status(404).json({ error: "Element not found" });
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
        id: { [Op.gte]: 3377 }, // ← esclude i contenitori padre
      },
      include: [
        {
          model: ElemetModel,
          as: "element_model",
          attributes: ["id", "parent_element_model_id", "ESWBS_code", "LCNtype_ID"],
          where: {
            ...(lcnTypes?.length && { LCNtype_ID: { [Op.in]: lcnTypes } }),
            ESWBS_code: { [Op.notLike]: "%0" },
          },
          required: true,
        },
      ],
    });

    if (!flatElements.length) return res.status(404).json({ error: "No elements found" });

    const map = {};
    flatElements.forEach((el) => {
      map[el.id] = {
        id: el.id.toString(),
        name: el.name,
        code: el.serial_number,
        LCNtype_ID: el.element_model?.LCNtype_ID,
        eswbs_code: el.element_model?.ESWBS_code,
        element_model_id: el.element_model?.id,
        parent_element_model_id: el.element_model?.parent_element_model_id,
        children: [],
      };
    });

    const modelIdMap = {};
    flatElements.forEach((el) => {
      if (el.element_model) modelIdMap[el.element_model.id] = map[el.id];
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
    return res.status(500).json({ error: "Server error while retrieving elements" });
  }
};

// ─── POST /api/elements/:ship_model_id/dymo-export ───────────────────────────
// Body: { teamId?, lcnTypes?, elementIds? }
//   elementIds fornito → esporta solo quelli; omesso → tutti gli elementi della nave
exports.exportDymoExcel = async (req, res) => {
  const { ship_model_id } = req.params;
  const { teamId, lcnTypes, elementIds } = req.body;
  const BASE_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://scia-frontend.vercel.app";

  try {
    const shipWhere = { id: ship_model_id };
    if (teamId) shipWhere.team = teamId;

    const ship = await Ship.findOne({ where: shipWhere });
    if (!ship) return res.status(404).json({ error: "Ship not found" });

    const elementWhere = {
      ship_id: ship.id,
      element_model_id: { [Op.ne]: null },
    };
    if (elementIds?.length) elementWhere.id = { [Op.in]: elementIds };

    const elements = await Element.findAll({
      where: elementWhere,
      include: [
        {
          model: ElemetModel,
          as: "element_model",
          attributes: ["id", "parent_element_model_id", "ESWBS_code", "LCNtype_ID"],
          where: {
            ...(lcnTypes?.length && { LCNtype_ID: { [Op.in]: lcnTypes } }),
            ESWBS_code: { [Op.notLike]: "%0" },
          },
          required: true,
        },
      ],
      order: [[{ model: ElemetModel, as: "element_model" }, "ESWBS_code", "ASC"]],
    });

    if (!elements.length) return res.status(404).json({ error: "No elements found" });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SCIA";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Foglio1");
    sheet.columns = [
      { header: "ESWBS",        key: "eswbs",  width: 13 },
      { header: "QR-CODE URL",  key: "url",    width: 55.5 },
      { header: "CODE",         key: "code",   width: 13 },
      { header: "DESCRIPTION1", key: "desc1",  width: 28.25 },
      { header: "DESCRIPTION2", key: "desc2",  width: 28.25 },
      { header: "DESCRIPTION3", key: "desc3",  width: 28.25 },
      { header: "DESCRIPTION4", key: "desc4",  width: 28.25 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { name: "Arial", bold: true, size: 10 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 18;

    for (const el of elements) {
      const [d1, d2, d3, d4] = splitDescription(el.name);
      const row = sheet.addRow({
        eswbs: el.element_model?.ESWBS_code || "",
        url:   `${BASE_APP_URL}/dashboard/impianti/${el.id}`,
        code:  el.serial_number || "",
        desc1: d1, desc2: d2, desc3: d3, desc4: d4,
      });
      row.font = { name: "Arial", size: 10 };
      row.height = 15;
    }

    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };

    const filename = `dymo_import_nave${ship_model_id}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Error generating DYMO Excel:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};