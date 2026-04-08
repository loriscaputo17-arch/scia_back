const { Scans, Element, Ship, ElemetModel } = require("../models");

exports.getScans = async (req, res) => {
  try {
    const { ship_id, user_id } = req.query;

    if (!ship_id || !user_id) {
      return res.status(400).json({ error: "I parametri ship_id e user_id sono obbligatori." });
    }

    const scans = await Scans.findAll({
      where: { ship_id, user_id },
      order: [["scanned_at", "DESC"]],
      include: [
        {
          model: Element,
          as: 'element',
          attributes: ["id", "name", "element_model_id", "ship_id", "serial_number", "installation_date", "progressive_code", "time_to_work"],
          include: [
            {
              model: ElemetModel,
              as: 'element_model',
              attributes: ["id", "ESWBS_code", "LCN", "LCNtype_ID", "LCN_name"],
            }
          ]
        },
        {
          model: Ship,
          as: 'ship',
          attributes: ["id", "unit_name"],
        },
      ],
    });

    res.status(200).json(scans);
  } catch (error) {
    console.error("Errore nel recupero delle scans:", error);
    res.status(500).json({ error: "Errore nel recupero delle scans" });
  }
};

exports.saveScan = async (req, res) => {
  try {
    const { scanId, scannedData, scannedAt } = req.body;

    if (!scanId || !scannedData || !scannedAt) {
      return res.status(400).json({ error: "Parametri mancanti: scanId, scannedData e scannedAt sono obbligatori." });
    }

    const scan = await Scans.findByPk(scanId);

    if (!scan) {
      return res.status(404).json({ error: "Scan non trovato." });
    }

    scan.result = scannedData;
    scan.scanned_at = scannedAt;

    await scan.save();

    res.status(200).json({ message: "Scan aggiornato correttamente.", scan });
  } catch (error) {
    console.error("Errore nel salvataggio dello scan:", error);
    res.status(500).json({ error: "Errore nel salvataggio dello scan." });
  }
};

exports.createScan = async (req, res) => {
  try {
    const { element_id, ship_id, user_id, result } = req.body;

    if (!element_id || !ship_id || !user_id) {
      return res.status(400).json({ error: "element_id, ship_id e user_id sono obbligatori." });
    }

    const newScan = await Scans.create({
      element_id,
      ship_id,
      user_id,
      result: result || null,
      scanned_at: new Date(),
      created_at: new Date(),
    });

    res.status(201).json({ message: "Scan salvato.", scan: newScan });
  } catch (error) {
    console.error("Errore nel salvataggio della scan:", error);
    res.status(500).json({ error: "Errore nel salvataggio della scan." });
  }
};
