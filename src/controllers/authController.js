const { UserLogin, User, TeamShipAccess, Team, TeamMember } = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const SECRET_KEY = "supersecretkey";
const { getUserPermissions } = require("../middleware/auth");

exports.loginWithEmail = async (req, res) => {
  const { email, password } = req.body;

  try {
    const userLogin = await UserLogin.findOne({ where: { email } });
    if (!userLogin) {
      return res.status(401).json({ error: "Credentials are not valid." });
    }

    console.log(password)

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
    // 1. Trova l'utente dal PIN (il PIN è personale, non globale)
    const userLogin = await UserLogin.findOne({
      where: { pin, pin_enabled: true },
      include: { model: User, as: "user" },
    });

    if (!userLogin || !userLogin.user) {
      return res.status(401).json({ error: "PIN non valido o disabilitato." });
    }

    const userId = userLogin.user.id;

    // 2. Verifica che l'utente abbia accesso alla nave richiesta
    //    TeamShipAccess → Team → TeamMembers → User
    const hasAccess = await TeamShipAccess.findOne({
      where: { ship_id: shipId },
      include: {
        model: Team,
        as: "Team",          // deve corrispondere all'alias definito sopra
        required: true,
        include: {
          model: TeamMember,
          as: "teamTeamMembers",   // alias già definito nel tuo index.js
          where: { user_id: userId },
          required: true,
        },
      },
    });

    if (!hasAccess) {
      return res
        .status(403)
        .json({ error: "Utente non autorizzato per questa nave." });
    }

    // 3. Carica i permessi dell'utente, filtrati sulla nave specifica
    const ships = await getUserPermissions(userId);
    const shipPermissions = ships.find((s) => s.shipId === Number(shipId));

    if (!shipPermissions) {
      return res
        .status(403)
        .json({ error: "Nessun permesso trovato per questa nave." });
    }

    // 4. Emetti il token con contesto completo
    const token = jwt.sign(
      {
        userId,
        shipId: Number(shipId),
        // Moduli accessibili su questa nave specifica
        modules: shipPermissions.modules,
      },
      process.env.SECRET_KEY,
      { expiresIn: "8h" }
    );

    return res.json({ message: "Login PIN effettuato", token });
  } catch (error) {
    console.error("Errore durante il login con PIN:", error);
    res.status(500).json({ error: "Errore durante il login rapido" });
  }
};

/*
exports.loginWithPin = async (req, res) => {
  const { pin } = req.body;

  try {
    const userLogin = await UserLogin.findOne({
      where: { pin, pin_enabled: true },
      include: { model: User, as: "user" },
    });

    if (!userLogin || !userLogin.user) {
      return res.status(401).json({ error: "PIN non valido o disabilitato." });
    }

    const token = jwt.sign({ userId: userLogin.user.id }, process.env.SECRET_KEY);

    // ✅ Imposta il token nei cookie (identico al login con email)
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: 2 * 60 * 60 * 1000, // 2 ore
    });
    

    res.json({ message: "Login PIN effettuato" });
  } catch (error) {
    console.error("Errore durante il login con PIN:", error);
    res.status(500).json({ error: "Errore durante il login rapido" });
  }
};*/

exports.setPin = async (req, res) => {
  const { email, pin } = req.body;

  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: "The PIN must consist of 4 digits." });
  }

  try {
    const [updated] = await UserLogin.update({ pin }, { where: { email } });

    if (updated === 0) {
      return res.status(404).json({ error: "User not found." });
    }

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
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: "PIN must be exactly 4 digits." });
      }
      updateData.pin = pin;
      updateData.pin_enabled = true;
    }

    await user.update(updateData);

    res.json({ message: "Security settings updated successfully." });

  } catch (error) {
    console.error("Error updating security settings:", error);
    res.status(500).json({ error: "Error updating security settings" });
  }
};
