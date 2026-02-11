const { Owner, OrganizationCompanyNCAGE, sequelize } = require("../../models");
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

// 🔹 POST - Crea un nuovo owner
exports.createOwner = async (req, res) => {
  try {
    // Accetta sia singolo oggetto che array
    const body = Array.isArray(req.body) ? req.body : [req.body];

    // 🔹 Normalizza i dati: tieni solo OrganizationCompanyNCAGE_ID (numerico)
    const cleanData = body.map((item) => ({
      companyName: item.companyName,
      Organisation_name: item.Organisation_name || null,
      address: item.address || null,
      country: item.country || null,
      armedForces: item.armedForces || null,
      OrganizationCompanyNCAGE_ID: item.OrganizationCompanyNCAGE_ID
        ? parseInt(item.OrganizationCompanyNCAGE_ID)
        : null,
    }));

    // 🔹 Crea tutti i record
    const newOwners = await Owner.bulkCreate(cleanData, { returning: true });

    // 🔹 Recupera i record creati con l’associazione OrganizationCompanyNCAGE
    const createdWithOrg = await Owner.findAll({
      where: { ID: newOwners.map((o) => o.ID) },
      include: [
        {
          model: OrganizationCompanyNCAGE,
          as: "organizationCompany",
        },
      ],
    });

    return res.status(201).json(createdWithOrg);
  } catch (error) {
    console.error("Errore durante la creazione degli owner:", error);
    return res
      .status(500)
      .json({ error: "Errore durante la creazione degli owner" });
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

