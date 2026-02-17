const { Owner, OrganizationCompanyNCAGE, OrganizationCompanyNCAGE_Entity, sequelize } = require("../../models");
require("dotenv").config();

// 🔹 GET - Ottiene tutti gli owners
exports.getOwners = async (req, res) => {
  try {
    const owners = await Owner.findAll({
      include: [
        {
          model: OrganizationCompanyNCAGE,
          as: "organizationCompany",
        },
      ],
      order: [["companyName", "ASC"]],
    });

    return res.json(owners);
  } catch (error) {
    console.error("Errore nel recupero owners:", error);
    return res.status(500).json({ error: "Errore nel recupero owners" });
  }
};

exports.createOwner = async (req, res) => {
  const transaction = await OrganizationCompanyNCAGE.sequelize.transaction();

  try {
    const {
      companyName,
      Organisation_name,
      address,
      country,
      armedForces,
      // campi OrganizationCompanyNCAGE
      Organization_name,
      City,
      Country,
      NCAGE_Code,
    } = req.body;

    // 1️⃣ CREA OrganizationCompanyNCAGE
    const organization = await OrganizationCompanyNCAGE.create(
      {
        Organization_name,
        Country,
        City,
        NCAGE_Code,
      },
      { transaction }
    );

    // 2️⃣ CREA Owner CON LO STESSO ID
    const owner = await Owner.create(
      {
        ID: organization.ID, // 🔥 FONDAMENTALE
        companyName,
        Organisation_name,
        address,
        country,
        armedForces,
        OrganizationCompanyNCAGE_ID: organization.ID,
      },
      { transaction }
    );

    // 3️⃣ (opzionale) tabella ponte
    await OrganizationCompanyNCAGE_Entity.create(
      {
        company_id: organization.ID,
        entity_type: "Owner",
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      message: "Owner creato con successo",
      owner,
      organization,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("❌ Errore createOwner:", error);
    return res.status(500).json({
      error: "CREATE_OWNER_ERROR",
      message: "Errore durante la creazione dell'owner",
    });
  }
};

exports.updateOwner = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      companyName,
      Organisation_name,
      address,
      country,
      armedForces,
      hasNCAGE,
      organizationCompanyNCAGE,
    } = req.body;

    console.log(Organisation_name)

    const owner = await Owner.findByPk(id, { transaction: t });

    if (!owner) {
      await t.rollback();
      return res.status(404).json({ error: "Owner non trovato" });
    }

    await owner.update(
      {
        companyName,
        Organisation_name,
        address,
        country,
        armedForces,
      },
      { transaction: t }
    );

    if (hasNCAGE && organizationCompanyNCAGE) {
      const { ID, ...ncageData } = organizationCompanyNCAGE;

      let ncage;

      if (owner.OrganizationCompanyNCAGE_ID) {
        ncage = await OrganizationCompanyNCAGE.findByPk(
          owner.OrganizationCompanyNCAGE_ID,
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

        await owner.update(
          { OrganizationCompanyNCAGE_ID: ncage.ID },
          { transaction: t }
        );
      }
    }

    if (!hasNCAGE && owner.OrganizationCompanyNCAGE_ID) {
      await owner.update(
        { OrganizationCompanyNCAGE_ID: null },
        { transaction: t }
      );
    }

    await t.commit();

    const updated = await Owner.findByPk(id, {
      include: [
        {
          model: OrganizationCompanyNCAGE,
          as: "organizationCompany",
        },
      ],
    });

    return res.json(updated);
  } catch (error) {
    await t.rollback();
    console.error("Errore updateOwner:", error);
    return res
      .status(500)
      .json({ error: "Errore durante l'aggiornamento dell'owner" });
  }
};