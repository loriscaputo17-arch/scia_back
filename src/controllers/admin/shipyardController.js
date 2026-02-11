const {
  Shipyards,
  OrganizationCompanyNCAGE,
  shipModel,
  sequelize,
} = require("../../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.getShipyard = async (req, res) => {
  try {
    const shipyards = await Shipyards.findAll({
      include: [
        {
          model: OrganizationCompanyNCAGE,
          as: "organizationCompanyNCAGE",
        },
      ],
      order: [["companyName", "ASC"]],
    });

    return res.json(shipyards);
  } catch (error) {
    console.error("Errore nel recupero cantieri:", error);
    return res.status(500).json({ error: "Errore nel recupero cantieri" });
  }
};

exports.getAvailableShipModels = async (req, res) => {
  try {
    const models = await shipModel.findAll({});

    return res.json(models);
  } catch (error) {
    console.error("Errore modelli nave disponibili:", error);
    return res.status(500).json({ error: "Errore recupero modelli nave" });
  }
};

exports.updateShipyard = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      companyName,
      address,
      country,
      hasNCAGE,
      organizationCompanyNCAGE,
    } = req.body;

    const shipyard = await Shipyards.findByPk(id, { transaction: t });

    if (!shipyard) {
      await t.rollback();
      return res.status(404).json({ error: "Cantiere non trovato" });
    }

    await shipyard.update(
      { companyName, address, country },
      { transaction: t }
    );

    if (hasNCAGE && organizationCompanyNCAGE) {
      const {
        ID, // ← SCARTATO VOLONTARIAMENTE
        ...ncageData
      } = organizationCompanyNCAGE;

      let ncage;

      if (shipyard.OrganizationCompanyNCAGE_ID) {
        ncage = await OrganizationCompanyNCAGE.findByPk(
          shipyard.OrganizationCompanyNCAGE_ID,
          { transaction: t }
        );

        if (ncage) {
          await ncage.update(ncageData, { transaction: t });
        }
      } else {
        ncage = await OrganizationCompanyNCAGE.create(
          ncageData,
          { transaction: t }
        );

        await shipyard.update(
          { OrganizationCompanyNCAGE_ID: ncage.ID },
          { transaction: t }
        );
      }
    }

    if (!hasNCAGE && shipyard.OrganizationCompanyNCAGE_ID) {
      await shipyard.update(
        { OrganizationCompanyNCAGE_ID: null },
        { transaction: t }
      );
    }

    await t.commit();

    const updated = await Shipyards.findByPk(id, {
      include: [
        {
          model: OrganizationCompanyNCAGE,
          as: "organizationCompanyNCAGE",
        },
      ],
    });

    return res.json(updated);
  } catch (error) {
    await t.rollback();
    console.error("Errore updateShipyard:", error);
    return res
      .status(500)
      .json({ error: "Errore durante l'aggiornamento del cantiere" });
  }
};

exports.createShipyards = async (req, res) => {
  try {
    const body = Array.isArray(req.body) ? req.body : [req.body];

    const validData = body.filter(
      (item) =>
        item.companyName &&
        item.address &&
        item.country &&
        item.OrganizationCompanyNCAGE_ID
    );

    if (validData.length === 0) {
      return res
        .status(400)
        .json({ error: "Dati mancanti o non validi per la creazione dei cantieri" });
    }

    const newShipyards = await Shipyards.bulkCreate(validData, { returning: true });

    const createdWithOrg = await Shipyards.findAll({
      where: { ID: newShipyards.map((s) => s.ID) },
      include: [
        {
          model: OrganizationCompanyNCAGE,
          as: "organizationCompanyNCAGE",
        },
      ],
    });

    return res.status(201).json(createdWithOrg);
  } catch (error) {
    console.error("Errore durante la creazione dei cantieri:", error);
    return res
      .status(500)
      .json({ error: "Errore durante la creazione dei cantieri" });
  }
};