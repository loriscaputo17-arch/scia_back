require('dotenv').config();
var pjson = require('../../package.json');
const logger = require('../../logger')

const { UserLogin, User, UserRole, Team, RanksMarine, Ship, TeamMember } = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
 
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});


const s3 = new AWS.S3();

const BUCKET_NAME = 'scia-project-questit';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

exports.getProfile = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Token missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    // 🔹 Recupero UserLogin + User + Team base
    const userLogin = await UserLogin.findOne({
      where: { user_id: decoded.userId },
      attributes: ["email"],
      include: {
        model: User,
        as: "user",
        attributes: [
          "id", "first_name", "last_name", "profile_image",
          "phone_number", "registration_date", "team_id",
          "bot_id_ita", "bot_id_ing", "bot_id_esp"
        ],
        include: [
          {
            model: Team,
            as: "team",
            attributes: ["id", "name", "team_leader_id"],
            include: [
              {
                model: User,
                as: "teamLeader",
                attributes: ["first_name", "last_name"]
              },
              {
                model: Ship,
                as: "ship",
                attributes: [
                  "id", "ship_model_id", "fleet_id",
                  "model_code", "unit_name", "unit_code",
                  "launch_date", "delivery_date", "Side_ship_number"
                ]
              }
            ]
          }
        ]
      }
    });

    if (!userLogin || !userLogin.user) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userLogin.user;

    // -----------------------------------------------------
    // 🔍 Trova TeamMember → Team → Ship
    // -----------------------------------------------------
    const teamMembership = await TeamMember.findOne({
      where: { user_id: user.id },
      include: [
        {
          model: Team,
          as: "team",
          include: [
            {
              model: User,
              as: "teamLeader",
              attributes: ["id", "first_name", "last_name"]
            },
            {
              model: Ship,
              as: "ship",
              attributes: [
                "id", "ship_model_id", "fleet_id",
                "model_code", "unit_name", "unit_code",
                "Side_ship_number"
              ]
            }
          ]
        }
      ]
    });

    let teamInfo = null;

    if (teamMembership) {
      teamInfo = {
        teamMemberId: teamMembership.id,
        userId: teamMembership.user_id,
        teamId: teamMembership.team?.id || null,
        teamName: teamMembership.team?.name || null,
        teamLeader: teamMembership.team?.teamLeader
          ? {
              id: teamMembership.team.teamLeader.id,
              firstName: teamMembership.team.teamLeader.first_name,
              lastName: teamMembership.team.teamLeader.last_name
            }
          : null,
        assignedShip: teamMembership.team?.ship
          ? {
              id: teamMembership.team.ship.id,
              unitName: teamMembership.team.ship.unit_name,
              unitCode: teamMembership.team.ship.unit_code,
              shipModelId: teamMembership.team.ship.ship_model_id,
              sideShipNumber: teamMembership.team.ship.Side_ship_number
            }
          : null
      };
    }

    // -----------------------------------------------------
    // 🔖 Recupera ruolo utente
    // -----------------------------------------------------
    const userRole = await UserRole.findOne({ where: { user_id: user.id } });
    if (!userRole) {
      return res.status(404).json({ error: "Role not found" });
    }

    // -----------------------------------------------------
    // 🔗 Signed URL per immagine profilo
    // -----------------------------------------------------
    const extractS3Key = (url) => {
      if (!url) return null;
      try {
        const u = new URL(url);
        return u.pathname.startsWith("/") ? u.pathname.slice(1) : u.pathname;
      } catch {
        return url;
      }
    };

    let signedProfileImageUrl = null;

    if (user.profile_image) {
      const key = extractS3Key(user.profile_image);
      try {
        signedProfileImageUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
          { expiresIn: 3600 }
        );
      } catch {
        console.warn("Errore generando URL immagine profilo");
      }
    }

    // -----------------------------------------------------
    // 📤 Risposta finale
    // -----------------------------------------------------
    return res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: userLogin.email,
      role: userRole.role_name || "N/A",
      type: userRole.type,
      rank: userRole.rank,
      profileImage: signedProfileImageUrl,
      phoneNumber: user.phone_number,
      registrationDate: user.registration_date,
      botIds: {
        ita: user.bot_id_ita,
        ing: user.bot_id_ing,
        esp: user.bot_id_esp
      },
      teamInfo
    });

  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({ error: "Invalid token" });
  }
};


exports.getUsers = async (req, res) => {
  const teamId = req.params.teamId;

  try {
    const teamMembers = await TeamMember.findAll({
      where: { team_id: teamId },
      include: [
        {
          model: User,
          as: "user",
          include: [
            {
              model: UserRole,
              as: "role",
            },
          ],
        },
        {
          model: Team,
          as: "team",
        },
        {
          model: Ship,
          as: "ship",
        },
      ],
    });

    if (!teamMembers || teamMembers.length === 0) {
      return res.status(404).json({ error: "No users found for this team" });
    }

    const usersData = teamMembers.map((member) => {
      const user = member.user;
      const userRole = user.role;

      return {
        ...user?.toJSON?.(),
        isLeader: member.is_leader,
        team: member.team ? member.team.toJSON() : null,
        ship: member.ship ? member.ship.toJSON() : null,
        role: userRole ? userRole.toJSON() : null,
      };
    });

    res.json(usersData);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getProfileById = async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const requestedUserId = req.params.id;

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    const userLogin = await UserLogin.findOne({
      where: { user_id: requestedUserId },
      attributes: ["email"],
      include: {
        model: User,
        as: "user",
        attributes: [
          "id",
          "first_name",
          "last_name",
          "profile_image",
          "phone_number",
          "registration_date",
          "team_id",
        ],
        include: [
          {
            model: Team,
            as: "team",
            attributes: ["id", "name", "team_leader_id"],
            include: [
              {
                model: User,
                as: "teamLeader",
                attributes: ["first_name", "last_name"],
              },
            ],
          },
        ],
      },
    });

    if (!userLogin || !userLogin.user) {
      return res.status(404).json({ error: "User not found" });
    }

    const {
      id,
      first_name,
      last_name,
      profile_image,
      phone_number,
      registration_date,
      team,
    } = userLogin.user;
    const { email } = userLogin;

    const userRole = await UserRole.findOne({ where: { user_id: id } });

    if (!userRole) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Funzione helper per estrarre chiave S3
    const extractS3Key = (url) => {
      if (!url) return null;
      try {
        const u = new URL(url);
        return u.pathname.startsWith("/") ? u.pathname.slice(1) : u.pathname;
      } catch (e) {
        return url;
      }
    };

    let signedProfileImageUrl = null;
    if (profile_image) {
      const profileImageKey = extractS3Key(profile_image);
      const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: profileImageKey });
      try {
        signedProfileImageUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      } catch (err) {
        console.warn("Errore generando URL firmato per profile_image:", err);
      }
    }

    res.json({
      id,
      firstName: first_name,
      lastName: last_name,
      rank: userRole.rank,
      type: userRole.type,
      role: userRole.role_name || "N/A",
      profileImage: signedProfileImageUrl,
      email,
      phoneNumber: phone_number,
      registrationDate: registration_date,
      team: team ? { id: team.id, name: team.name } : null,
      teamLeader: team?.teamLeader
        ? { firstName: team.teamLeader.first_name, lastName: team.teamLeader.last_name }
        : null,
    });
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({ error: "Invalid token" });
  }
};

exports.updateProfile = async (req, res) => {
  const { userId, firstName, lastName, email, phoneNumber, rank } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.update({
      first_name: firstName,
      last_name: lastName,
      phone_number: phoneNumber,
      email: email,
    });

    // Aggiorna la email (se presente)
    if (email) {
      await UserLogin.update({ email }, { where: { user_id: userId } });
    }

    if (rank) {
      await UserRole.update({ rank }, { where: { user_id: userId } });
    }

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}; 

exports.uploadProfileImage = async (req, res) => {
  try {
    const userId = req.body.userId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "Nessun file caricato" });
    }

    const fileName = `profile_images/${userId}.jpg`;

    // 🔥 Upload usando AWS SDK v3 (senza ACL)
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    // URL pubblico (senza signed URL)
    const imageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    await user.update({ profile_image: imageUrl });

    res.status(200).json({
      message: "Immagine profilo aggiornata con successo",
      url: imageUrl,
    });

  } catch (error) {
    console.error("Errore upload profilo:", error);
    res.status(500).json({ error: "Errore nel caricamento dell'immagine" });
  }
};  

exports.getRanks = async (req, res) => {
  try {
    const ranks = await RanksMarine.findAll();
    res.status(200).json(ranks);
  } catch (error) {
    console.error('Errore nel recupero dei gradi:', error);
    res.status(500).json({ error: 'Errore nel recupero dei dati' });
  }
};

exports.getAPIbackend = async (req, res) => {

  try {
    res.json({
      version: pjson.version,
    });
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({ error: "Invalid token" });
  }
};

exports.getLogs = (req, res) => {
  const logType = req.query.type === 'error' ? 'error.log' : 'combined.log';
  const logPath = path.join(process.cwd(), logType);

  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      logger.error(`Impossibile leggere il file di log: ${logType}`, { error: err });
      return res.status(500).json({ message: 'Errore durante la lettura dei log.', error: err.message });
    }

    try {
      const logs = data
        .split('\n')
        .filter(line => line.trim() !== '') 
        .map(line => JSON.parse(line));
      res.json(logs.reverse());
    } catch (parseErr) {
      logger.error(`Errore nel parsing dei log: ${logType}`, { error: parseErr });
      res.status(500).json({ message: 'Errore durante il parsing dei log.', error: parseErr.message });
    }
  });
};

exports.updateUserElements = async (req, res) => {
  const { userId } = req.params;
  const { elements } = req.body;

  if (!Array.isArray(elements)) {
    return res.status(400).json({ error: "Il campo elements deve essere un array." });
  }

  try {
    const userRole = await UserRole.findOne({ where: { user_id: userId } });

    if (!userRole) {
      return res.status(404).json({ error: "Ruolo utente non trovato." });
    }

    userRole.Elements = elements.join(",");
    await userRole.save();

    return res.json({
      message: "Elements aggiornato con successo.",
      role: userRole,
    });
  } catch (error) {
    console.error("Errore aggiornando Elements:", error);
    return res.status(500).json({ error: "Errore interno del server." });
  }
};

