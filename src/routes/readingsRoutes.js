const express = require("express");
const router = express.Router();
const readingsController = require("../controllers/readingsController");

/**
 * @swagger
 * tags:
 *   name: Readings
 *   description: Gestione letture strumenti nave
 */

/**
 * @swagger
 * /api/readings/getReadings:
 *   get:
 *     summary: Recupera tutte le letture di una nave
 *     description: Restituisce le letture filtrate per nave, con tipo e modello elemento associato
 *     tags: [Readings]
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
 *         description: Lista letture recuperata con successo
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 ship_id: 1
 *                 recurrence: "7"
 *                 type:
 *                   id: 2
 *                   name: "Pressione"
 *                 element:
 *                   id: 3
 *                   name: "Motore Principale"
 *                   element_model_id: 10
 *                   ship_id: 1
 *                   serial_number: "SN-001"
 *                   installation_date: "2023-01-01"
 *                   progressive_code: "EL-003"
 *                   element_model:
 *                     id: 10
 *                     name: "Modello X"
 *       400:
 *         description: Parametri obbligatori mancanti
 *         content:
 *           application/json:
 *             example:
 *               error: "I parametri ship_id e user_id sono obbligatori."
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore nel recupero delle letture"
 */
router.get("/getReadings", readingsController.getReadings);

/**
 * @swagger
 * /api/readings/getReading:
 *   get:
 *     summary: Recupera una singola lettura
 *     description: Restituisce il dettaglio di una lettura filtrata per id e user_id, con tipo e modello elemento
 *     tags: [Readings]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID della lettura
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID utente
 *     responses:
 *       200:
 *         description: Lettura recuperata con successo
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 ship_id: 1
 *                 user_id: 5
 *                 type:
 *                   id: 2
 *                   name: "Pressione"
 *                 element:
 *                   id: 3
 *                   name: "Motore Principale"
 *                   element_model_id: 10
 *                   ship_id: 1
 *                   serial_number: "SN-001"
 *                   installation_date: "2023-01-01"
 *                   progressive_code: "EL-003"
 *                   element_model:
 *                     id: 10
 *                     name: "Modello X"
 *       400:
 *         description: Parametri obbligatori mancanti
 *         content:
 *           application/json:
 *             example:
 *               error: "I parametri ship_id e user_id sono obbligatori."
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore nel recupero delle letture"
 */
router.get("/getReading", readingsController.getReading);

/**
 * @swagger
 * /api/readings/{id}:
 *   put:
 *     summary: Aggiorna una lettura esistente
 *     description: Aggiorna i campi di una lettura tramite il suo ID. Il body può contenere qualsiasi campo del modello Readings.
 *     tags: [Readings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID della lettura da aggiornare
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value:
 *                 type: number
 *                 example: 45.0
 *                 description: Nuovo valore della lettura
 *               recurrence:
 *                 type: string
 *                 example: "14"
 *                 description: Ricorrenza della lettura in giorni
 *               notes:
 *                 type: string
 *                 example: "Lettura aggiornata dopo manutenzione"
 *                 description: Note aggiuntive
 *     responses:
 *       200:
 *         description: Lettura aggiornata con successo, restituisce il record aggiornato
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               ship_id: 1
 *               value: 45.0
 *               recurrence: "14"
 *               notes: "Lettura aggiornata dopo manutenzione"
 *       400:
 *         description: Parametro id mancante
 *         content:
 *           application/json:
 *             example:
 *               error: "Parametro 'id' mancante."
 *       404:
 *         description: Lettura non trovata o nessuna modifica effettuata
 *         content:
 *           application/json:
 *             example:
 *               error: "Lettura non trovata o nessuna modifica effettuata."
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore nell'aggiornamento della lettura."
 */
router.put("/:id", readingsController.updateReading);

module.exports = router;