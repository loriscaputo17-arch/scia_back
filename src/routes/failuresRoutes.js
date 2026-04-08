const express = require("express");
const router = express.Router();
const failureController = require("../controllers/failuresController");

/**
 * @swagger
 * tags:
 *   name: Failures
 *   description: Gestione guasti e task nave
 */

/**
 * @swagger
 * /api/failures/addFailure:
 *   post:
 *     summary: Crea un nuovo guasto
 *     description: Aggiunge un nuovo record di guasto associato a una nave
 *     tags: [Failures]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - ship_id
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Guasto motore principale"
 *                 description: Titolo del guasto
 *               description:
 *                 type: string
 *                 example: "Il motore principale ha smesso di funzionare"
 *                 description: Descrizione dettagliata del guasto
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-03-15T10:30:00Z"
 *                 description: Data e ora del guasto
 *               gravity:
 *                 type: string
 *                 example: "high"
 *                 description: Gravità del guasto
 *               executionUserType:
 *                 type: string
 *                 example: "internal"
 *                 description: Tipo di utente che gestisce il guasto
 *               userExecution:
 *                 type: integer
 *                 example: 5
 *                 description: ID utente assegnato all'esecuzione
 *               partNumber:
 *                 type: string
 *                 example: "PN-001-XYZ"
 *                 description: Numero parte coinvolta nel guasto
 *               customFields:
 *                 type: object
 *                 example: { "field1": "valore1", "field2": "valore2" }
 *                 description: Campi personalizzati aggiuntivi
 *               ship_id:
 *                 type: integer
 *                 example: 1
 *                 description: ID della nave
 *     responses:
 *       201:
 *         description: Guasto creato con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Failure created successfully"
 *               failure:
 *                 id: 10
 *                 title: "Guasto motore principale"
 *                 description: "Il motore principale ha smesso di funzionare"
 *                 date: "2024-03-15T10:30:00Z"
 *                 gravity: "high"
 *                 executionUserType: "internal"
 *                 userExecution: 5
 *                 partNumber: "PN-001-XYZ"
 *                 customFields: { "field1": "valore1" }
 *                 ship_id: 1
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Error creating failure"
 */
router.post("/addFailure", failureController.addFailure);

/**
 * @swagger
 * /api/failures/getFailures:
 *   get:
 *     summary: Recupera guasti e task di una nave
 *     description: >
 *       Restituisce un oggetto con due array: `failures` (guasti filtrabili per gravity,
 *       executionUserType e ship_id) e `tasks` (JobExecution con Check_List="2",
 *       ovvero solo le checklist, con manutenzione, elemento, stato e note associate)
 *     tags: [Failures]
 *     parameters:
 *       - in: query
 *         name: ship_id
 *         required: false
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID della nave (obbligatorio per ottenere i task)
 *       - in: query
 *         name: userId
 *         required: false
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID utente
 *       - in: query
 *         name: gravity
 *         required: false
 *         schema:
 *           type: string
 *         example: "high"
 *         description: Filtra i guasti per gravità
 *       - in: query
 *         name: executionUserType
 *         required: false
 *         schema:
 *           type: string
 *         example: "internal"
 *         description: Filtra i guasti per tipo utente esecutore
 *     responses:
 *       200:
 *         description: Guasti e task recuperati con successo
 *         content:
 *           application/json:
 *             example:
 *               failures:
 *                 - id: 1
 *                   title: "Guasto motore"
 *                   description: "Motore non parte"
 *                   date: "2024-03-15T10:30:00Z"
 *                   gravity: "high"
 *                   executionUserType: "internal"
 *                   userExecution: 5
 *                   ship_id: 1
 *                   userExecutionData:
 *                     id: 5
 *                     first_name: "Mario"
 *                     last_name: "Rossi"
 *               tasks:
 *                 - id: 10
 *                   ship_id: 1
 *                   ending_date: "2024-04-01T00:00:00Z"
 *                   maintenance_list:
 *                     id: 3
 *                     Check_List: "2"
 *                     maintenance_level:
 *                       id: 1
 *                       name: "Livello 1"
 *                     recurrency_type:
 *                       id: 2
 *                       name: "Mensile"
 *                   status:
 *                     id: 1
 *                     name: "In corso"
 *                   Element:
 *                     id: 5
 *                     name: "Motore Principale"
 *                     element_model:
 *                       id: 10
 *                       name: "Modello X"
 *                   vocalNotes: []
 *                   textNotes: []
 *                   photographicNotes: []
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Error retrieving failures and tasks"
 */
router.get("/getFailures", failureController.getFailures);

module.exports = router;