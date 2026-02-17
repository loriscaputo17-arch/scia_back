const {
  Shipyards,
  OrganizationCompanyNCAGE,
  shipModel,
  OrganizationCompanyNCAGE_Entity,
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
  const transaction = await OrganizationCompanyNCAGE.sequelize.transaction();

  try {
    const body = Array.isArray(req.body) ? req.body : [req.body];

    if (!body.length) {
      return res.status(400).json({
        error: "Nessun dato fornito",
      });
    }

    const created = [];

    for (const item of body) {
      const {
        companyName,
        address,
        country,
        hasNCAGE,
        organizationCompanyNCAGE,
      } = item;

      if (!companyName || !address || !country) {
        throw new Error("Dati obbligatori mancanti");
      }

      // 1️⃣ CREA OrganizationCompanyNCAGE
      const organization = await OrganizationCompanyNCAGE.create(
        {
          Organization_name: companyName,
          Country: country,
          City: organizationCompanyNCAGE?.City ?? null,
          NCAGE_Code: hasNCAGE
            ? organizationCompanyNCAGE?.NCAGE_Code ?? null
            : null,
        },
        { transaction }
      );

      // 2️⃣ CREA Shipyard CON STESSO ID
      const shipyard = await Shipyards.create(
        {
          ID: organization.ID, // 🔥 PK condivisa
          companyName,
          address,
          country,
          OrganizationCompanyNCAGE_ID: organization.ID,
        },
        { transaction }
      );

      // 3️⃣ TABELLA PONTE
      await OrganizationCompanyNCAGE_Entity.create(
        {
          company_id: organization.ID,
          entity_type: "Shipyard",
        },
        { transaction }
      );

      created.push(shipyard);
    }

    await transaction.commit();

    // 4️⃣ RITORNA CON INCLUDE
    const createdWithOrg = await Shipyards.findAll({
      where: { ID: created.map((s) => s.ID) },
      include: [
        {
          model: OrganizationCompanyNCAGE,
          as: "organizationCompanyNCAGE",
        },
      ],
    });

    return res.status(201).json(createdWithOrg);
  } catch (error) {
    await transaction.rollback();

    console.error("❌ Errore createShipyards:", error);
    return res.status(500).json({
      error: "CREATE_SHIPYARD_ERROR",
      message: error.message,
    });
  }
};
