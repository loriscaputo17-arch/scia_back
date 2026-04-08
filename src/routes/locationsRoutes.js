const express = require("express");
const router = express.Router();
const locationsController = require("../controllers/locationsController");

/**
 * @swagger
 * tags:
 *   name: Locations
 *   description: Gestione ubicazioni e magazzini nave
 */

/**
 * @swagger
 * /api/locations/getLocations:
 *   get:
 *     summary: Recupera tutte le ubicazioni di una nave
 *     description: Restituisce le ubicazioni con info magazzino (signed URL icona S3) e conteggio ricambi per ubicazione
 *     tags: [Locations]
 *     parameters:
 *       - in: query
 *         name: ship_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID della nave
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID utente
 *     responses:
 *       200:
 *         description: Lista ubicazioni recuperata con successo
 *         content:
 *           application/json:
 *             example:
 *               locations:
 *                 - id: 1
 *                   ship_id: 1
 *                   user_id: 5
 *                   warehouse: 2
 *                   location: "Scaffale A3"
 *                   spare_count: 12
 *                   warehouseInfo:
 *                     id: 2
 *                     name: "Magazzino Principale"
 *                     icon_url: "https://signed-s3-url..."
 *                     user_id: 5
 *       400:
 *         description: Parametri obbligatori mancanti
 *         content:
 *           application/json:
 *             example:
 *               error: "Missing ship_id or user_id"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Error fetching locations"
 */
router.get("/getLocations", locationsController.getLocations);

/**
 * @swagger
 * /api/locations/addLocation:
 *   post:
 *     summary: Crea una nuova ubicazione
 *     description: Aggiunge una nuova ubicazione associata a un magazzino e una nave
 *     tags: [Locations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - warehouse
 *               - ship_id
 *               - user_id
 *               - location
 *             properties:
 *               warehouse:
 *                 type: integer
 *                 example: 2
 *                 description: ID del magazzino
 *               ship_id:
 *                 type: integer
 *                 example: 1
 *                 description: ID della nave
 *               user_id:
 *                 type: integer
 *                 example: 5
 *                 description: ID utente
 *               location:
 *                 type: string
 *                 example: "Scaffale A3"
 *                 description: Nome o descrizione dell'ubicazione
 *     responses:
 *       201:
 *         description: Ubicazione creata con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Ubicazione creata con successo"
 *               location:
 *                 id: 10
 *                 warehouse: 2
 *                 ship_id: 1
 *                 user_id: 5
 *                 location: "Scaffale A3"
 *       400:
 *         description: Campi obbligatori mancanti
 *         content:
 *           application/json:
 *             example:
 *               error: "Missing required fields"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore durante la creazione della nuova ubicazione"
 */
router.post("/addLocation", locationsController.addLocation);

module.exports = router;