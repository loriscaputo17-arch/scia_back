// routes/team.js
const router = require("express").Router();
const team = require("../controllers/teamController");

// Utenti
router.post("/createUser", team.createUser);
router.delete("/:teamId/member/:userId", team.removeMember);
router.put("/:userId/role", team.assignRole);
router.put("/:userId/elements", team.assignUserElements);

// Permessi a livello TEAM (per nave)
router.get("/:teamId/:shipId/modules", team.getTeamModules);
router.put("/:teamId/:shipId/modules", team.setTeamModules);
router.get("/:teamId/:shipId/elements", team.getTeamElements);
router.put("/:teamId/:shipId/elements", team.setTeamElements);

module.exports = router;

// Montaggio in app.js:
// app.use("/api/team", require("./routes/team"));