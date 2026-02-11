const express = require("express");
const router = express.Router();
const shipyardController = require("../../controllers/admin/shipyardController");

router.get("/getShipyards", shipyardController.getShipyard);
router.post("/createShipyards", shipyardController.createShipyards);
router.put("/updateShipyard/:id", shipyardController.updateShipyard);
router.get("/getAvailableShipModels", shipyardController.getAvailableShipModels);

module.exports = router;