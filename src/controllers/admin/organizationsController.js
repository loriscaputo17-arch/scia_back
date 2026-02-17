const {
  OrganizationCompanyNCAGE,
  OrganizationCompanyNCAGE_Entity,
} = require("../../models");
const { Op } = require("sequelize");
require("dotenv").config();

exports.getOrganizations = async (req, res) => {
  try {
    const organizations = await OrganizationCompanyNCAGE.findAll({
      order: [["Organization_name", "ASC"]],
    });

    return res.json(organizations);
  } catch (error) {
    console.error("❌ Errore nel recupero organizations:", error);
    return res
      .status(500)
      .json({ error: "Errore nel recupero organizations" });
  }
};

exports.getProducers = async (req, res) => {
  try {
    // 1️⃣ tabella ponte
    const entities = await OrganizationCompanyNCAGE_Entity.findAll({
      where: { entity_type: "Producer" },
      attributes: ["company_id"],
    });

    const companyIds = entities.map(e => e.company_id);

    if (!companyIds.length) return res.json([]);

    // 2️⃣ tabella finale
    const producers = await OrganizationCompanyNCAGE.findAll({
      where: {
        ID: {
          [Op.in]: companyIds,
        },
      },
      order: [["Organization_name", "ASC"]],
    });

    return res.json(producers);
  } catch (error) {
    console.error("❌ Errore getProducers:", error);
    return res.status(500).json({ error: "Errore recupero produttori" });
  }
};

exports.getSuppliers = async (req, res) => {
  try {
    const entities = await OrganizationCompanyNCAGE_Entity.findAll({
      where: { entity_type: "Supplier" },
      attributes: ["company_id"],
    });

    const companyIds = entities.map(e => e.company_id);

    if (!companyIds.length) return res.json([]);

    const suppliers = await OrganizationCompanyNCAGE.findAll({
      where: {
        ID: {
          [Op.in]: companyIds,
        },
      },
      order: [["Organization_name", "ASC"]],
    });

    return res.json(suppliers);
  } catch (error) {
    console.error("❌ Errore getSuppliers:", error);
    return res.status(500).json({ error: "Errore recupero fornitori" });
  }
};

exports.getOwners = async (req, res) => {
  try {
    const entities = await OrganizationCompanyNCAGE_Entity.findAll({
      where: { entity_type: "Owner" },
      attributes: ["company_id"],
    });

    const ownerIds = entities.map(e => e.company_id);

    if (!ownerIds.length) return res.json([]);

    const owners = await Owner.findAll({
      where: {
        ID: {
          [Op.in]: ownerIds,
        },
      },
      include: [
        {
          model: OrganizationCompanyNCAGE,
          as: "organizationCompany",
          required: false,
        },
      ],
      order: [["Organisation_name", "ASC"]],
    });

    return res.json(owners);
  } catch (error) {
    console.error("❌ Errore getOwners:", error);
    return res.status(500).json({ error: "Errore recupero owners" });
  }
};

exports.getShipyards = async (req, res) => {
  try {
    const entities = await OrganizationCompanyNCAGE_Entity.findAll({
      where: { entity_type: "Shipyard" },
      attributes: ["company_id"],
    });

    const shipyardIds = entities.map(e => e.company_id);

    if (!shipyardIds.length) return res.json([]);

    const shipyards = await Shipyard.findAll({
      where: {
        ID: {
          [Op.in]: shipyardIds,
        },
      },
      include: [
        {
          model: OrganizationCompanyNCAGE,
          as: "organizationCompanyNCAGE",
          required: false,
        },
      ],
      order: [["companyName", "ASC"]],
    });

    return res.json(shipyards);
  } catch (error) {
    console.error("❌ Errore getShipyards:", error);
    return res.status(500).json({ error: "Errore recupero cantieri" });
  }
};


exports.updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      Organization_name,
      Country,
      City,
      Status,
      Street_Line_1,
      Street_Line_2,
      Postal_code,
      Website,
      Phone_number,
      Fax_number,
      NCAGE_Code,
    } = req.body;

    // 🔹 Recupera organization
    const organization = await OrganizationCompanyNCAGE.findOne({
      where: { ID: id },
    });

    if (!organization) {
      return res.status(404).json({
        error: "ORGANIZATION_NOT_FOUND",
        message: "Organizzazione non trovata",
      });
    }

    // 🔹 Update SOLO campi consentiti
    await organization.update({
      Organization_name,
      Country,
      City,
      Status,
      Street_Line_1,
      Street_Line_2,
      Postal_code,
      Website,
      Phone_number,
      Fax_number,
      NCAGE_Code,
    });

    return res.json({
      message: "Organizzazione aggiornata con successo",
      organization,
    });
  } catch (error) {
    console.error("❌ Errore update organization:", error);
    return res.status(500).json({
      error: "UPDATE_ORGANIZATION_ERROR",
      message: "Errore durante l'aggiornamento dell'organizzazione",
    });
  }
};

exports.createProducer = async (req, res) => {
  const transaction = await OrganizationCompanyNCAGE.sequelize.transaction();

  try {
    const {
      Organization_name,
      Country,
      City,
      Status,
      Street_Line_1,
      Street_Line_2,
      Postal_code,
      Website,
      Phone_number,
      Fax_number,
      NCAGE_Code,
    } = req.body;

    // 1️⃣ Crea OrganizationCompanyNCAGE
    const organization = await OrganizationCompanyNCAGE.create(
      {
        Organization_name,
        Country,
        City,
        Status,
        Street_Line_1,
        Street_Line_2,
        Postal_code,
        Website,
        Phone_number,
        Fax_number,
        NCAGE_Code,
      },
      { transaction }
    );

    // 2️⃣ Collega come Producer (tabella ponte)
    await OrganizationCompanyNCAGE_Entity.create(
      {
        company_id: organization.ID,
        entity_type: "Producer",
      },
      { transaction }
    );

    // 3️⃣ Commit
    await transaction.commit();

    return res.status(201).json({
      message: "Produttore creato con successo",
      organization,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("❌ Errore createProducer:", error);
    return res.status(500).json({
      error: "CREATE_PRODUCER_ERROR",
      message: "Errore durante la creazione del produttore",
    });
  }
};

