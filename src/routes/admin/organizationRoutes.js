const express = require("express");
const router = express.Router();
const organizationController = require("../../controllers/admin/organizationsController");

router.get("/getOrganizations", organizationController.getOrganizations);

router.get("/getShipyards", organizationController.getShipyards);
router.get("/getOwners", organizationController.getOwners);
router.get("/getSuppliers", organizationController.getSuppliers);
router.get("/getProducers", organizationController.getProducers);
router.post("/createProducer", organizationController.createProducer);

router.put(
  "/updateOrganization/:id",
  organizationController.updateOrganization
);

module.exports = router;
