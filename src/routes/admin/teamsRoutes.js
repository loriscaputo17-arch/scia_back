const express = require("express");
const router = express.Router();
const teamController = require("../../controllers/admin/teamController");

// 🔹 GET
router.get("/getTeams", teamController.getTeams);
router.get("/getTeamMembers/:id", teamController.getTeamMembers);

// 🔹 PUT
router.put("/updateTeam/:id", teamController.updateTeam);
router.put("/updateTeamMembers/:id", teamController.updateTeamMembers);

// 🔹 POST (NUOVO)
router.post("/createTeams", teamController.createTeams);

module.exports = router;
