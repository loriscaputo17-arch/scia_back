const {
  UserLogin,
  User,
  TeamShipAccess,
  Team,
  TeamMember,
  PinLoginAttempt,    // 🔒 nuovo: tracking tentativi PIN
  sequelize,          // per raw query univocità per nave
} = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const SECRET_KEY = "supersecretkey";
const { getUserPermissions } = require("../middleware/auth");
const { validatePin } = require("../utils/validatePin");
const { Op } = require("sequelize");

// ─── Config sicurezza PIN ────────────────────────────────────────────────────
const PIN_MAX_ATTEMPTS = 5;            // tentativi prima del blocco
const PIN_LOCK_DURATION_MIN = 15;      // durata blocco in minuti

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Estrae l'IP client. Se l'app sta dietro proxy (Nginx, Cloudflare),
// app.set('trust proxy', true) va impostato in app.js perché req.ip
// rifletta x-forwarded-for in modo affidabile.
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "unknown";
}

// Restituisce gli user che condividono almeno una nave con `userId`
// (escluso `userId` stesso) e hanno un PIN impostato.
// Usato per controllare l'univocità del PIN PER NAVE (non globale).
async function findUsersOnSameShips(userId) {
  const [rows] = await sequelize.query(
    `
    SELECT DISTINCT ul.user_id, ul.pin
    FROM UserLogin ul
    JOIN TeamMembers tm  ON tm.user_id  = ul.user_id
    JOIN TeamShipAccess tsa ON tsa.team_id = tm.team_id
    WHERE tsa.ship_id IN (
      SELECT tsa2.ship_id
      FROM TeamMembers tm2
      JOIN TeamShipAccess tsa2 ON tsa2.team_id = tm2.team_id
      WHERE tm2.user_id = ?
    )
    AND ul.user_id <> ?
    AND ul.pin IS NOT NULL
    `,
    { replacements: [userId, userId] }
  );
  return rows;
}

// Verifica che il PIN proposto non sia già in uso da un altro utente
// che condivide almeno una nave. Restituisce true se l'univocità è rispettata.
async function isPinUniqueForUserShips(userId, plainPin) {
  const others = await findUsersOnSameShips(userId);
  for (const u of others) {
    if (!u.pin) continue;
    const same = u.pin.startsWith("$2")
      ? await bcrypt.compare(plainPin, u.pin)
      : u.pin === plainPin;
    if (same) return false;
  }
  return true;
}

// ─── LOGIN EMAIL+PASSWORD (INVARIATO) ────────────────────────────────────────
exports.loginWithEmail = async (req, res) => {
  const { email, password } = req.body;

  try {
    const userLogin = await UserLogin.findOne({ where: { email } });
    if (!userLogin) {
      return res.status(401).json({ error: "Credentials are not valid." });
    }

    const isMatch = await bcrypt.compare(password, userLogin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Credentials are not valid." });
    }

    // Carica le navi accessibili all'account (lista condivisa, non utente specifico)
    const ships = await getUserPermissions(userLogin.user_id);

    // Nessun token: il frontend salva le navi e aspetta il PIN
    return res.json({ ships });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Error during login" });
  }
};

// ─── LOGIN PIN (con lockout + pre-filtro candidati PER NAVE) ─────────────────
//
// 🔒 FIX: prima di cercare il PIN, restringiamo i candidati ai soli utenti
// che hanno effettivamente accesso a `shipId` (via TeamMembers + TeamShipAccess).
// Con l'univocità PIN "per nave" due utenti su navi diverse possono avere
// LO STESSO PIN: senza pre-filtro il loop poteva matchare il PIN di un altro
// utente NON autorizzato per la nave richiesta, far fallire il login e
// nascondere quello legittimo. Ora la ricerca è deterministica.
//
// Bonus: meno bcrypt.compare da fare → più veloce.
//
exports.loginWithPin = async (req, res) => {
  const { pin, shipId } = req.body;

  if (!pin || !shipId) {
    return res.status(400).json({ error: "PIN e shipId sono obbligatori." });
  }

  const clientIp = getClientIp(req);
  const shipIdNum = Number(shipId);

  try {
    // 1. Verifica lockout per (IP, nave)
    let attemptRow = await PinLoginAttempt.findOne({
      where: { ip: clientIp, ship_id: shipIdNum },
    });

    if (attemptRow?.locked_until) {
      const now = new Date();
      if (attemptRow.locked_until > now) {
        const remainingMs = attemptRow.locked_until.getTime() - now.getTime();
        const remainingMin = Math.ceil(remainingMs / 60000);
        return res.status(423).json({
          error: `Troppi tentativi falliti. Riprova tra ${remainingMin} minuti.`,
          lockedUntil: attemptRow.locked_until,
          remainingMinutes: remainingMin,
        });
      }
      // Lock scaduto: pulisci e prosegui
      await attemptRow.update({ locked_until: null, attempts: 0 });
    }

    // 2. 🔒 Pre-filtro: trova SOLO gli user_id che hanno accesso a questa nave
    //    e hanno il PIN abilitato. Usa una raw query per chiarezza.
    const [accessRows] = await sequelize.query(
      `
      SELECT DISTINCT ul.user_id
      FROM UserLogin ul
      JOIN TeamMembers tm ON tm.user_id = ul.user_id
      JOIN TeamShipAccess tsa ON tsa.team_id = tm.team_id
      WHERE tsa.ship_id = ?
        AND ul.pin_enabled = 1
        AND ul.pin IS NOT NULL
      `,
      { replacements: [shipIdNum] }
    );

    const candidateUserIds = accessRows.map((r) => r.user_id);

    // Nessun utente abilitato per questa nave → fail immediato (e registra tentativo)
    if (candidateUserIds.length === 0) {
      await registerFailedAttempt(clientIp, shipIdNum);
      return res.status(401).json({ error: "PIN non valido o disabilitato." });
    }

    // 3. Carica solo i candidates con accesso alla nave (con istanze Sequelize per le update)
    const candidates = await UserLogin.findAll({
      where: {
        user_id: { [Op.in]: candidateUserIds },
        pin_enabled: true,
        pin: { [Op.ne]: null },
      },
      include: { model: User, as: "user" },
    });

    // 4. Cerca il match del PIN tra i candidati pre-filtrati
    let userLogin = null;
    for (const c of candidates) {
      if (!c.user) continue;
      let match = false;
      if (c.pin.startsWith("$2")) {
        match = await bcrypt.compare(pin, c.pin);
      } else {
        match = c.pin === pin;
        if (match) {
          // Migrazione trasparente: ri-hasho i vecchi PIN in chiaro
          const hash = await bcrypt.hash(pin, 10);
          await c.update({ pin: hash });
        }
      }
      if (match) {
        userLogin = c;
        break;
      }
    }

    // 5. Nessun match → tentativo fallito
    if (!userLogin || !userLogin.user) {
      await registerFailedAttempt(clientIp, shipIdNum);
      return res.status(401).json({ error: "PIN non valido o disabilitato." });
    }

    const userId = userLogin.user.id;

    // 6. (Ridondante ma difensivo) Verifica formale accesso alla nave.
    //    Il pre-filtro lo garantisce già, ma manteniamo come check di sicurezza
    //    nel caso le tabelle siano cambiate fra una query e l'altra.
    const hasAccess = await TeamShipAccess.findOne({
      where: { ship_id: shipIdNum },
      include: {
        model: Team,
        as: "Team",
        required: true,
        include: {
          model: TeamMember,
          as: "teamTeamMembers",
          where: { user_id: userId },
          required: true,
        },
      },
    });

    if (!hasAccess) {
      await registerFailedAttempt(clientIp, shipIdNum);
      return res.status(403).json({ error: "Utente non autorizzato per questa nave." });
    }

    // 7. Permessi
    const ships = await getUserPermissions(userId);
    const shipPermissions = ships.find((s) => s.shipId === shipIdNum);
    if (!shipPermissions) {
      return res.status(403).json({ error: "Nessun permesso trovato per questa nave." });
    }

    // 8. SUCCESS → reset tentativi
    if (attemptRow) {
      await attemptRow.update({ attempts: 0, locked_until: null });
    }

    // 9. Token
    const token = jwt.sign(
      { userId, shipId: shipIdNum, modules: shipPermissions.modules },
      process.env.SECRET_KEY,
      { expiresIn: "8h" }
    );

    return res.json({ message: "Login PIN effettuato", token });
  } catch (error) {
    console.error("Errore durante il login con PIN:", error);
    res.status(500).json({ error: "Errore durante il login rapido" });
  }
};

// Helper interno: registra un tentativo fallito ed eventualmente attiva il lock.
async function registerFailedAttempt(ip, shipId) {
  try {
    let row = await PinLoginAttempt.findOne({ where: { ip, ship_id: shipId } });
    if (!row) {
      row = await PinLoginAttempt.create({
        ip,
        ship_id: shipId,
        attempts: 1,
        last_attempt_at: new Date(),
      });
    } else {
      const newAttempts = (row.attempts || 0) + 1;
      const update = { attempts: newAttempts, last_attempt_at: new Date() };
      if (newAttempts >= PIN_MAX_ATTEMPTS) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + PIN_LOCK_DURATION_MIN);
        update.locked_until = lockUntil;
      }
      await row.update(update);
    }
  } catch (err) {
    // Non fare crashare il login a causa del tracking
    console.error("Errore tracking tentativo PIN:", err);
  }
}

// ─── SET PIN (con univocità PER NAVE) ────────────────────────────────────────
exports.setPin = async (req, res) => {
  const { email, pin } = req.body;

  // Formato 8 cifre + regole
  const check = validatePin(pin);
  if (!check.valid) return res.status(400).json({ error: check.error });

  try {
    const me = await UserLogin.findOne({ where: { email } });
    if (!me) return res.status(404).json({ error: "User not found." });

    // 🔒 Univocità PER NAVE: il PIN non deve coincidere con quello di un altro
    // utente che condivide almeno una nave con `me.user_id`.
    const isUnique = await isPinUniqueForUserShips(me.user_id, pin);
    if (!isUnique) {
      return res
        .status(400)
        .json({ error: "Scegli un PIN diverso: è già in uso su una nave a cui hai accesso." });
    }

    const hash = await bcrypt.hash(pin, 10);
    const [updated] = await UserLogin.update({ pin: hash }, { where: { email } });
    if (updated === 0) return res.status(404).json({ error: "User not found." });

    res.json({ message: "PIN updated successfully." });
  } catch (error) {
    console.error("Error updating PIN:", error);
    res.status(500).json({ error: "Error updating PIN" });
  }
};

// ─── LOGOUT (INVARIATO) ──────────────────────────────────────────────────────
exports.logout = (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logout successful" });
};

// ─── FORGOT PASSWORD (INVARIATO) ─────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await UserLogin.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: "Email not found" });
    }

    // 15 minutes
    const token = jwt.sign({ userId: user.user_id }, SECRET_KEY);

    const resetLink = `http://localhost:3000/reset-password?token=${token}`;

    // Send email
    await transporter.sendMail({
      from: "noreply@yourapp.com",
      to: email,
      subject: "Reset Password",
      text: `Click this link to reset your password: ${resetLink}`,
    });

    res.json({ message: "Reset link sent to your email" });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// ─── RESET PASSWORD (INVARIATO) ──────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await UserLogin.findOne({ where: { user_id: decoded.userId } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await user.update({ password_hash: hashedPassword });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(400).json({ error: "Invalid or expired token" });
  }
};

// ─── GET SECURITY SETTINGS (INVARIATO) ───────────────────────────────────────
exports.getUserSecuritySettings = async (req, res) => {
  try {
    const userId = req.user?.userId || req.body.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const user = await UserLogin.findOne({
      where: { user_id: userId },
      attributes: ["biometric_enabled", "pin_enabled"],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json(user);
  } catch (error) {
    console.error("Error retrieving security settings:", error);
    res.status(500).json({ error: "Error retrieving security settings" });
  }
};

// ─── UPDATE SECURITY SETTINGS (con univocità PER NAVE per il PIN) ────────────
exports.updateUserSecuritySettings = async (req, res) => {
  const {
    useBiometric,
    useQuickPin,
    pin,
    userId,
    oldPassword,
    newPassword,
  } = req.body;

  try {
    const user = await UserLogin.findOne({ where: { user_id: userId } });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (newPassword) {
      const isValid = await bcrypt.compare(oldPassword, user.password_hash);
      if (!isValid) {
        return res.status(400).json({ error: "Old password incorrect." });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await user.update({ password_hash: hashedPassword });
    }

    // --- PIN & SECURITY FLAGS ---
    let updateData = {
      biometric_enabled: useBiometric,
      pin_enabled: useQuickPin,
    };

    if (pin) {
      // 1) Formato 8 cifre + regole
      const check = validatePin(pin);
      if (!check.valid) return res.status(400).json({ error: check.error });

      // 2) 🔒 Univocità PER NAVE
      const isUnique = await isPinUniqueForUserShips(userId, pin);
      if (!isUnique) {
        return res
          .status(400)
          .json({ error: "Scegli un PIN diverso: è già in uso su una nave a cui hai accesso." });
      }

      const hash = await bcrypt.hash(pin, 10);
      updateData.pin = hash;
      updateData.pin_enabled = true;
    }

    await user.update(updateData);
    res.json({ message: "Security settings updated successfully." });
  } catch (error) {
    console.error("Error updating security settings:", error);
    res.status(500).json({ error: "Error updating security settings" });
  }
};