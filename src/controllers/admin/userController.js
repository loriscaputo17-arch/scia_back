const { User, UserLogin, UserRole, UserSettings } = require("../../models");
const bcrypt = require("bcryptjs");

/**
 * GET /api/admin/users/getUsers
 * Recupera tutti gli utenti con login, ruolo e impostazioni
 */
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [
        { model: UserLogin, as: "login" },
        { model: UserRole, as: "role" },
        { model: UserSettings, as: "settings" },
      ],
      order: [["id", "ASC"]],
    });

    const formatted = users.map((u) => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.login?.email || null,
      role: u.role?.role_name || "N/A",
      active: !!u.login,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Errore nel recupero utenti:", error);
    res.status(500).json({ error: "Errore nel recupero utenti" });
  }
};

/**
 * POST /api/admin/users/createUsers
 * Crea uno o più utenti completi (User + UserLogin + UserRole + UserSettings)
 */
exports.createUsers = async (req, res) => {
  try {
    const body = Array.isArray(req.body) ? req.body : [req.body];

    const createdUsers = [];

    for (const data of body) {
      // 🔹 Crea User base
      const newUser = await User.create({
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone_number || null,
      });

      // 🔹 Crea UserLogin
      const passwordHash = data.password
        ? await bcrypt.hash(data.password, 10)
        : null;

      await UserLogin.create({
        user_id: newUser.id,
        email: data.email,
        password_hash: passwordHash,
      });

      // 🔹 Crea UserRole
      await UserRole.create({
        user_id: newUser.id,
        role_name: data.role_name || "User",
        rank: data.rank || null,
        type: data.type || null,
        Elements: data.Elements || null,
      });

      // 🔹 Crea UserSettings
      await UserSettings.create({
        user_id: newUser.id,
        license: data.license || "STD",
        is_notifications_enabled_maintenance:
          data.is_notifications_enabled_maintenance || false,
        maintenance_frequency: data.maintenance_frequency || "mensile",
        is_notifications_enabled_checklist:
          data.is_notifications_enabled_checklist || false,
        checklist_frequency: data.checklist_frequency || "mensile",
      });

      createdUsers.push(newUser);
    }

    res.status(201).json(createdUsers);
  } catch (error) {
    console.error("Errore durante la creazione utenti:", error);
    res.status(500).json({ error: "Errore durante la creazione utenti" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: "Utente non trovato" });

    await User.destroy({ where: { id } });

    res.json({ message: "Utente eliminato correttamente" });
  } catch (error) {
    console.error("Errore durante l'eliminazione dell'utente:", error);
    res.status(500).json({ error: "Errore durante l'eliminazione" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, role, active, password } = req.body;

    const user = await User.findByPk(id, {
      include: [{ model: UserLogin, as: "login" }],
    });

    if (!user) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    await user.update({ first_name, last_name });

    if (user.login) {
      if (typeof active === "boolean" && !active) {
        await UserLogin.destroy({ where: { user_id: id } });
      } else if (password && password.length > 0) {
        const hash = await bcrypt.hash(password, 10);
        await user.login.update({ password_hash: hash });
      }
    }

    if (role) {
      await UserRole.update(
        { role_name: role },
        { where: { user_id: id } }
      );
    }

    const updated = await User.findByPk(id, {
      include: [
        { model: UserLogin, as: "login" },
        { model: UserRole, as: "role" },
      ],
    });

    return res.json({
      id: updated.id,
      first_name: updated.first_name,
      last_name: updated.last_name,
      email: updated.login?.email || null,
      role: updated.role?.role_name || "N/A",
      active: !!updated.login,
    });
  } catch (error) {
    console.error("Errore aggiornamento utente:", error);
    res.status(500).json({ error: "Errore aggiornamento utente" });
  }
};
