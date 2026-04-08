const express = require("express");
const router = express.Router();
const facilitiesController = require("../controllers/facilitiesController");

/**
 * @swagger
 * tags:
 *   name: Facilities
 *   description: Gestione facilities nave
 */

/**
 * @swagger
 * /api/facilities/getFacilities:
 *   get:
 *     summary: Recupera tutte le facilities
 *     description: Restituisce la lista completa delle facilities con le relative sub-facilities annidate
 *     tags: [Facilities]
 *     responses:
 *       200:
 *         description: Lista facilities recuperata con successo
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 name: "Sala macchine"
 *                 parent_id: null
 *                 subFacilities:
 *                   - id: 3
 *                     name: "Motori"
 *                     parent_id: 1
 *                     subFacilities: []
 *                   - id: 4
 *                     name: "Generatori"
 *                     parent_id: 1
 *                     subFacilities: []
 *               - id: 2
 *                 name: "Ponte di comando"
 *                 parent_id: null
 *                 subFacilities:
 *                   - id: 5
 *                     name: "Strumentazione"
 *                     parent_id: 2
 *                     subFacilities: []
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore nel recupero delle facilities"
 */
router.get("/getFacilities", facilitiesController.getFacilities);

module.exports = router;