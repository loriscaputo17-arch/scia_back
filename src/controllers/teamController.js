// controllers/teamController.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const {
  User, UserLogin, UserRole, TeamMember, Team,
  AppModule, TeamModulePermission, TeamElementAccess,
} = require("../models");

const ROLE_LABELS = {
  machine_maintainer: "Machine Maintainer",
  chief_engineer: "Chief Engineer",
  comand: "Comand",
  admin: "Admin",
  owner: "Owner",
};

// ─── Genera password robusta (12 char) ────────────────────────────────────────
function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let pwd = "";
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) pwd += chars[bytes[i] % chars.length];
  return pwd;
}

// ─── Crea nuovo utente (password mostrata a schermo) ──────────────────────────
exports.createUser = async (req, res) => {
  const { firstName, lastName, email, teamId, roleType, rank } = req.body;

  if (!firstName || !lastName || !email || !teamId) {
    return res.status(400).json({ error: "firstName, lastName, email e teamId sono obbligatori." });
  }

  try {
    const existing = await UserLogin.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email già registrata." });

    const team = await Team.findByPk(teamId);
    if (!team) return res.status(404).json({ error: "Team non trovato." });

    // 1. User
    const user = await User.create({
      first_name: firstName,
      last_name: lastName,
      team_id: teamId,
      registration_date: new Date(),
    });

    // 2. Password generata + hash
    const plainPassword = generatePassword();
    const hash = await bcrypt.hash(plainPassword, 10);

    await UserLogin.create({
      user_id: user.id,
      email,
      password_hash: hash,
      pin_enabled: 0,
      biometric_enabled: 0,
    });

    // 3. Ruolo
    await UserRole.create({
        user_id: user.id,
        role_name: ROLE_LABELS[roleType] || "Machine Maintainer",
        type: roleType || "machine_maintainer",
        rank: rank || null,
        Elements: "",
        });

    // 4. Membro del team
    await TeamMember.create({
      team_id: teamId,
      user_id: user.id,
      is_leader: 0,
    });

    // Password in chiaro RESTITUITA UNA SOLA VOLTA (da mostrare all'admin)
    return res.json({
      message: "Utente creato.",
      userId: user.id,
      email,
      password: plainPassword,
    });
  } catch (error) {
    console.error("Errore creazione utente:", error);
    return res.status(500).json({ error: "Errore durante la creazione dell'utente." });
  }
};

// ─── Rimuovi membro dal team ──────────────────────────────────────────────────
exports.removeMember = async (req, res) => {
  const { teamId, userId } = req.params;
  try {
    const deleted = await TeamMember.destroy({ where: { team_id: teamId, user_id: userId } });
    if (deleted === 0) return res.status(404).json({ error: "Membro non trovato nel team." });
    return res.json({ message: "Membro rimosso dal team." });
  } catch (error) {
    console.error("Errore rimozione membro:", error);
    return res.status(500).json({ error: "Errore durante la rimozione." });
  }
};

// ─── Aggiorna ruolo (UserRole.type) ───────────────────────────────────────────
exports.assignRole = async (req, res) => {
  const { userId } = req.params;
  const { roleType } = req.body;

  const ROLE_LABELS = {
    machine_maintainer: "Machine Maintainer",
    chief_engineer: "Chief Engineer",
    comand: "Comand",
    admin: "Admin",
    owner: "Owner",
  };
  if (!ROLE_LABELS[roleType]) {
    return res.status(400).json({ error: "Ruolo non valido." });
  }

  try {
    const role = await UserRole.findOne({ where: { user_id: userId } });
    if (!role) return res.status(404).json({ error: "Ruolo non trovato." });
    role.type = roleType;
    role.role_name = ROLE_LABELS[roleType];
    await role.save();
    return res.json({ message: "Ruolo aggiornato.", role });
  } catch (error) {
    console.error("Errore aggiornamento ruolo:", error);
    return res.status(500).json({ error: "Errore durante l'aggiornamento del ruolo." });
  }
};

// ─── Impianti del singolo utente (UserRole.Elements) ──────────────────────────
exports.assignUserElements = async (req, res) => {
  const { userId } = req.params;
  const { elements } = req.body; // array di ESWBS/codici
  if (!Array.isArray(elements)) {
    return res.status(400).json({ error: "elements deve essere un array." });
  }
  try {
    const role = await UserRole.findOne({ where: { user_id: userId } });
    if (!role) return res.status(404).json({ error: "Ruolo non trovato." });
    role.Elements = elements.join(",");
    await role.save();
    return res.json({ message: "Impianti utente aggiornati.", role });
  } catch (error) {
    console.error("Errore aggiornamento impianti utente:", error);
    return res.status(500).json({ error: "Errore interno." });
  }
};

// ─── MODULI a livello TEAM (TeamModulePermission) ─────────────────────────────
// Lista moduli disponibili + permessi correnti del team su una nave
exports.getTeamModules = async (req, res) => {
  const { teamId, shipId } = req.params;
  try {
    const modules = await AppModule.findAll();
    const perms = await TeamModulePermission.findAll({
      where: { team_id: teamId, ship_id: shipId },
    });
    const byModule = {};
    perms.forEach((p) => { byModule[p.module_id] = { can_read: !!p.can_read, can_write: !!p.can_write }; });

    const result = modules.map((m) => ({
      id: m.id,
      code: m.code,
      label: m.label,
      can_read: byModule[m.id]?.can_read || false,
      can_write: byModule[m.id]?.can_write || false,
    }));
    return res.json(result);
  } catch (error) {
    console.error("Errore getTeamModules:", error);
    return res.status(500).json({ error: "Errore interno." });
  }
};

// Aggiorna i permessi moduli del team (upsert per ogni modulo)
exports.setTeamModules = async (req, res) => {
  const { teamId, shipId } = req.params;
  const { modules } = req.body; // [{ module_id, can_read, can_write }, ...]
  if (!Array.isArray(modules)) {
    return res.status(400).json({ error: "modules deve essere un array." });
  }
  try {
    for (const m of modules) {
      const [row, created] = await TeamModulePermission.findOrCreate({
        where: { team_id: teamId, ship_id: shipId, module_id: m.module_id },
        defaults: {
          can_read: m.can_read ? 1 : 0,
          can_write: m.can_write ? 1 : 0,
        },
      });
      if (!created) {
        row.can_read = m.can_read ? 1 : 0;
        row.can_write = m.can_write ? 1 : 0;
        await row.save();
      }
    }
    return res.json({ message: "Moduli del team aggiornati." });
  } catch (error) {
    console.error("Errore setTeamModules:", error);
    return res.status(500).json({ error: "Errore interno." });
  }
};

// ─── IMPIANTI a livello TEAM (TeamElementAccess) ──────────────────────────────
exports.getTeamElements = async (req, res) => {
  const { teamId, shipId } = req.params;
  try {
    const rows = await TeamElementAccess.findAll({ where: { team_id: teamId, ship_id: shipId } });
    return res.json(rows.map((r) => r.element_model_id));
  } catch (error) {
    console.error("Errore getTeamElements:", error);
    return res.status(500).json({ error: "Errore interno." });
  }
};

exports.setTeamElements = async (req, res) => {
  const { teamId, shipId } = req.params;
  const { elementModelIds } = req.body; // array di element_model_id
  if (!Array.isArray(elementModelIds)) {
    return res.status(400).json({ error: "elementModelIds deve essere un array." });
  }
  try {
    // strategia semplice: cancella e reinserisci
    await TeamElementAccess.destroy({ where: { team_id: teamId, ship_id: shipId } });
    for (const emId of elementModelIds) {
      await TeamElementAccess.create({ team_id: teamId, ship_id: shipId, element_model_id: emId });
    }
    return res.json({ message: "Impianti del team aggiornati." });
  } catch (error) {
    console.error("Errore setTeamElements:", error);
    return res.status(500).json({ error: "Errore interno." });
  }
};