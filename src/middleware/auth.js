// middleware/auth.js
const jwt = require("jsonwebtoken");

async function getUserPermissions(userId) {
  const { sequelize } = require("../models");
 
  const rows = await sequelize.query(`
    SELECT
      tsa.ship_id,
      s.unit_name      AS ship_name,
      am.code          AS module_code,
      tmp.can_read,
      tmp.can_write,
      GROUP_CONCAT(DISTINCT tea.element_model_id) AS allowed_elements
    FROM TeamMembers tm
    JOIN TeamShipAccess tsa
      ON tsa.team_id = tm.team_id
    JOIN Ship s
      ON s.id = tsa.ship_id
    LEFT JOIN TeamModulePermission tmp
      ON tmp.team_id = tm.team_id
     AND tmp.ship_id = tsa.ship_id
    LEFT JOIN AppModule am
      ON am.id = tmp.module_id
    LEFT JOIN TeamElementAccess tea
      ON tea.team_id = tm.team_id
     AND tea.ship_id = tsa.ship_id
    WHERE tm.user_id = :userId
    GROUP BY
      tsa.ship_id,
      s.unit_name,
      am.code,
      tmp.can_read,
      tmp.can_write
  `, {
    replacements: { userId },
    type: sequelize.QueryTypes.SELECT,  // ← restituisce array diretto, no destructuring
  });

  const shipsMap = {};

  for (const row of rows) {
    if (!shipsMap[row.ship_id]) {
      shipsMap[row.ship_id] = {
        shipId: row.ship_id,
        shipName: row.ship_name,
        allowedElementModels: row.allowed_elements
          ? row.allowed_elements.split(",").map(Number)
          : null,
        modules: {},
      };
    }

    if (row.module_code) {
      shipsMap[row.ship_id].modules[row.module_code] = {
        read:  Boolean(row.can_read),
        write: Boolean(row.can_write),
      };
    }
  }

  return Object.values(shipsMap);
}

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Non autenticato" });

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    const ships = await getUserPermissions(decoded.userId);

    req.user = {
      ...decoded,
      ships
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token scaduto, effettua di nuovo il login" });
    }
    res.status(401).json({ error: "Token non valido" });
  }
}

function requirePermission(module, action = "read") {
  return (req, res, next) => {
    const shipId = Number(
      req.params.shipId ||
      req.query.shipId  ||
      req.body?.shipId
    );


    if (!shipId) {
      return res.status(400).json({ error: "shipId mancante nella richiesta" });
    }

    const ship = req.user.ships?.find(s => s.shipId === shipId);
    if (!ship) {
      return res.status(403).json({ error: "Nessun accesso a questa nave" });
    }

    const perm = ship.modules?.[module];

    if (!perm?.read) {
      return res.status(403).json({ error: `Accesso negato al modulo: ${module}` });
    }
    if (action === "write" && !perm.write) {
      return res.status(403).json({ error: "Permesso di scrittura negato" });
    }

    req.shipAccess = ship;
    next();
  };
}

module.exports = { requireAuth, requirePermission, getUserPermissions };