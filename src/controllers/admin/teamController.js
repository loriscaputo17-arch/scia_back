const { Team, User, TeamMember, UserLogin, UserRole, ESWBS_Glossary } = require("../../models");
require("dotenv").config();
const { Op } = require("sequelize");

exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.findAll({
      include: [
        {
          model: User,
          as: "leader",
          include: [
            {
              model: UserLogin,
              as: "login",
              attributes: ["email"],
            },
          ],
        },
      ],
    });

    return res.json(teams);
  } catch (error) {
    console.error("Errore nel recupero squadre:", error);
    return res.status(500).json({ error: "Errore nel recupero squadre" });
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      role,
      manager,
      email,
      active,
      leader,
    } = req.body;

    const team = await Team.findByPk(id, {
      include: [
        {
          model: User,
          as: "leader",
          include: [{ model: UserLogin, as: "login" }],
        },
      ],
    });

    if (!team) {
      return res.status(404).json({ error: "Team non trovato" });
    }

    team.name = name ?? team.name;
    team.role = role ?? team.role;
    team.manager = manager ?? team.manager;
    team.email = email ?? team.email;
    team.active = active ?? team.active;

    await team.save();

    if (leader && team.leader) {
      const user = team.leader;

      if (leader.first_name) user.first_name = leader.first_name;
      if (leader.last_name) user.last_name = leader.last_name;

      await user.save();

      if (leader.login && leader.login.email && user.login) {
        user.login.email = leader.login.email;
        await user.login.save();
      }
    }

    const updatedTeam = await Team.findByPk(id, {
      include: [
        {
          model: User,
          as: "leader",
          include: [{ model: UserLogin, as: "login" }],
        },
      ],
    });

    return res.json({
      message: "Team aggiornato con successo",
      team: updatedTeam,
    });
  } catch (error) {
    console.error("Errore aggiornamento team:", error);
    return res
      .status(500)
      .json({ error: "Errore durante l'aggiornamento del team" });
  }
};

const ALLOWED_LEVEL1 = [
  "100", "200", "301", "400", "500",
  "600", "700", "800", "900",
];


exports.getTeamMembers = async (req, res) => {
  try {
    const { id } = req.params;

    const members = await TeamMember.findAll({
      where: { team_id: id },
      attributes: ["user_id", "is_leader"],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name"],
          include: [
            {
              model: UserLogin,
              as: "login",
              attributes: ["email"],
            },
            {
              model: UserRole,
              as: "role",
              attributes: ["rank", "type", "Elements", "role_name"],
            },
          ],
        },
      ],
    });

    const allElements = [
      ...new Set(
        members.flatMap((m) => {
          const elements = m.user?.role?.Elements;
          if (!elements) return [];

          return Array.isArray(elements)
            ? elements
            : elements.split(",").map((e) => e.trim());
        })
      ),
    ];

   const glossaryRows = await ESWBS_Glossary.findAll({
      where: {
        level1: {
          [Op.in]: ALLOWED_LEVEL1,
        },
      },
      attributes: ["level1", "name_navsea_S9040IDX"],
    });

    const glossaryMap = glossaryRows.reduce((acc, row) => {
      acc[row.level1] = row.name_navsea_S9040IDX;
      return acc;
    }, {});

    const users = members.map((m) => {
      const u = m.user?.toJSON();
      const r = u?.role || {};

      const elementsRaw = r.Elements || [];

      const elementsArray = (
        Array.isArray(elementsRaw)
          ? elementsRaw
          : typeof elementsRaw === "string"
            ? elementsRaw.split(",")
            : []
      )
        .map((e) =>
          typeof e === "string"
            ? e.trim()
            : typeof e === "object" && e.level1
              ? String(e.level1).trim()
              : null
        )
        .filter(
          (e) =>
            e &&
            ALLOWED_LEVEL1.includes(e)
        );

      const elementsWithGlossary = elementsArray.map((el) => ({
        level1: el,
        name_navsea_S9040IDX: glossaryMap[el] || null,
      }));

      return {
        id: u?.id,
        first_name: u?.first_name,
        last_name: u?.last_name,
        email: u?.login?.email || null,
        is_leader: m.is_leader || false,
        role_name: r.role_name || "",
        rank: r.rank || "",
        type: r.type || "",
        elements: elementsWithGlossary,
      };
    });

    return res.json(users);
  } catch (error) {
    console.error("❌ Errore nel recupero membri del team:", error);
    return res
      .status(500)
      .json({ error: "Errore nel recupero membri del team" });
  }
};

exports.updateTeamMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { members } = req.body;

    if (!Array.isArray(members)) {
      return res.status(400).json({ error: "Formato non valido: members deve essere un array" });
    }

    const team = await Team.findByPk(id);
    if (!team) return res.status(404).json({ error: "Team non trovato" });

    await TeamMember.destroy({ where: { team_id: id } });

    for (const member of members) {
      if (!member.user_id) continue;

      await TeamMember.create({
        team_id: id,
        user_id: member.user_id,
        is_leader: !!member.is_leader
      });

      // ✅ Aggiorna o crea il ruolo dell’utente
      const [role] = await UserRole.findOrCreate({
        where: { user_id: member.user_id },
        defaults: {
          role_name: member.role_name || "Member",
          Elements: member.elements || null
        }
      });

      await role.update({
        role_name: member.role_name || role.role_name,
        Elements: member.elements || role.Elements
      });
    }

    return res.json({ message: "Membri e ruoli aggiornati con successo" });
  } catch (error) {
    console.error("Errore aggiornamento membri team:", error);
    return res.status(500).json({ error: "Errore durante l'aggiornamento membri team" });
  }
};


