const express = require("express");
const router = express.Router();
const elementController = require("../controllers/elementController");

router.post("/addTimeWork", elementController.addElementTimeWork);
router.get("/updateElement/:elementId", elementController.updateElement);
router.post("/getElements/:ship_model_id/:user_id", elementController.getElements);
router.post("/getElement", elementController.getElement);
 
module.exports = router; 
