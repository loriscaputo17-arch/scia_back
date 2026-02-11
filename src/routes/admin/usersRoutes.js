const express = require("express");
const router = express.Router();
const userController = require("../../controllers/admin/userController");

router.get("/getUsers", userController.getUsers);
router.post("/createUsers", userController.createUsers);
router.delete("/deleteUser/:id", userController.deleteUser);
router.put("/updateUser/:id", userController.updateUser);

module.exports = router;
