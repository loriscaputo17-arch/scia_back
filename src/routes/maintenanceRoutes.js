const express = require("express");
const router = express.Router();
const maintenanceController = require("../controllers/maintenanceController");
const { requireAuth, requirePermission } = require("../middleware/auth");

// ─── Read ────────────────────────────────────────────────────────────────────
router.get("/type",
  requireAuth,
  requirePermission("maintenance", "read"),
  maintenanceController.getTypes
);

router.get("/getGeneralTypes",
  requireAuth,
  requirePermission("maintenance", "read"),
  maintenanceController.getGeneralTypes
);

router.get("/getMaintenanceLevels",
  requireAuth,
  requirePermission("maintenance", "read"),
  maintenanceController.getMaintenanceLevels
);

router.get("/jobs",
  requireAuth,
  requirePermission("maintenance", "read"),
  maintenanceController.getJobs
);

router.get("/jobs-on-condition",
  requireAuth,
  requirePermission("maintenance", "read"),
  maintenanceController.getJobsOnCondition
);

router.get("/follow-up",
  requireAuth,
  requirePermission("maintenance", "read"),
  maintenanceController.getFollowUpJobs
);

router.get("/job",
  requireAuth,
  requirePermission("maintenance", "read"),
  maintenanceController.getJob
);

// ─── Write ───────────────────────────────────────────────────────────────────
router.post("/updateStatus/:id",
  requireAuth,
  requirePermission("maintenance", "write"),
  maintenanceController.updateStatus
);

router.post("/saveStatusComment/:id",
  requireAuth,
  requirePermission("maintenance", "write"),
  maintenanceController.saveStatusComment
);

router.patch("/reportAnomaly/:id",
  requireAuth,
  requirePermission("maintenance", "write"),
  maintenanceController.reportAnomaly
);

router.patch("/markAsOk/:id",
  requireAuth,
  requirePermission("maintenance", "write"),
  maintenanceController.markAsOk
);

module.exports = router;