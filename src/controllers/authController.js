const { UserLogin, User, TeamShipAccess, Team, TeamMember } = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const SECRET_KEY = "supersecretkey";
const { getUserPermissions } = require("../middleware/auth");
const { validatePin } = require("../utils/validatePin");

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

exports.loginWithPin = async (req, res) => {
  const { pin, shipId } = req.body;

  if (!pin || !shipId) {
    return res.status(400).json({ error: "PIN e shipId sono obbligatori." });
  }

  try {
    const candidates = await UserLogin.findAll({
      where: { pin_enabled: true, pin: { [require("sequelize").Op.ne]: null } },
      include: { model: User, as: "user" },
    });

    let userLogin = null;
    for (const c of candidates) {
      if (!c.user) continue;
      let match = false;
      if (c.pin.startsWith("$2")) {
        match = await bcrypt.compare(pin, c.pin);        // nuovo: hash
      } else {
        match = c.pin === pin;                            // vecchio: chiaro (4 cifre)
        if (match) {
          // migrazione trasparente → ri-hasho il vecchio PIN
          const hash = await bcrypt.hash(pin, 10);
          await c.update({ pin: hash });
        }
      }
      if (match) { userLogin = c; break; }
    }

    if (!userLogin || !userLogin.user) {
      return res.status(401).json({ error: "PIN non valido o disabilitato." });
    }

    const userId = userLogin.user.id;

    // 2. Verifica accesso alla nave (INVARIATO)
    const hasAccess = await TeamShipAccess.findOne({
      where: { ship_id: shipId },
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
      return res.status(403).json({ error: "Utente non autorizzato per questa nave." });
    }

    // 3. Permessi (INVARIATO)
    const ships = await getUserPermissions(userId);
    const shipPermissions = ships.find((s) => s.shipId === Number(shipId));
    if (!shipPermissions) {
      return res.status(403).json({ error: "Nessun permesso trovato per questa nave." });
    }

    // 4. Token (INVARIATO)
    const token = jwt.sign(
      { userId, shipId: Number(shipId), modules: shipPermissions.modules },
      process.env.SECRET_KEY,
      { expiresIn: "8h" }
    );

    return res.json({ message: "Login PIN effettuato", token });
  } catch (error) {
    console.error("Errore durante il login con PIN:", error);
    res.status(500).json({ error: "Errore durante il login rapido" });
  }
};

exports.setPin = async (req, res) => {
  const { email, pin } = req.body;

  // Formato 8 cifre + regole
  const check = validatePin(pin);
  if (!check.valid) return res.status(400).json({ error: check.error });

  try {
    const me = await UserLogin.findOne({ where: { email } });
    if (!me) return res.status(404).json({ error: "User not found." });

    // Univocità tra utenti
    const { Op } = require("sequelize");
    const others = await UserLogin.findAll({
      where: { email: { [Op.ne]: email }, pin: { [Op.ne]: null } },
      attributes: ["id", "pin"],
    });
    for (const u of others) {
      const same = u.pin.startsWith("$2") ? await bcrypt.compare(pin, u.pin) : u.pin === pin;
      if (same) return res.status(400).json({ error: "Scegli un PIN diverso." });
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

exports.logout = (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logout successful" });
};

// Request to reset password
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

// Reset password
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

exports.getUserSecuritySettings = async (req, res) => {
  try {
    const userId = req.user?.userId || req.body.userId || req.query.userId; // Leggiamo userId

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

exports.updateUserSecuritySettings = async (req, res) => {
  const { 
    useBiometric, 
    useQuickPin, 
    pin, 
    userId, 
    oldPassword, 
    newPassword 
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
      // Formato 8 cifre + regole
      const check = validatePin(pin);
      if (!check.valid) return res.status(400).json({ error: check.error });

      // Univocità tra utenti
      const { Op } = require("sequelize");
      const others = await UserLogin.findAll({
        where: { user_id: { [Op.ne]: userId }, pin: { [Op.ne]: null } },
        attributes: ["id", "pin"],
      });
      for (const u of others) {
        const same = u.pin.startsWith("$2") ? await bcrypt.compare(pin, u.pin) : u.pin === pin;
        if (same) return res.status(400).json({ error: "Scegli un PIN diverso." });
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
