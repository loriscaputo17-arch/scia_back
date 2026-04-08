const express = require("express");
const router = express.Router();
const checklistController = require("../controllers/checklistController");

/**
 * @swagger
 * tags:
 *   name: Checklist
 *   description: Gestione checklist e task di manutenzione nave
 */

/**
 * @swagger
 * /api/checklist/getTasks:
 *   get:
 *     summary: Recupera i task di manutenzione (checklist)
 *     description: >
 *       Restituisce i JobExecution con Check_List="1" (manutenzioni ordinarie),
 *       paginati e filtrabili. I risultati sono ordinati con i task non eseguiti
 *       (execution_state null) prima, e quelli completati (stato 1 o 2) in fondo.
 *     tags: [Checklist]
 *     parameters:
 *       - in: query
 *         name: ship_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID della nave
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID utente
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         example: 1
 *         description: Numero di pagina (default 1)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 30
 *         example: 30
 *         description: Numero di risultati per pagina (default 30)
 *       - in: query
 *         name: nascondiEseguiti
 *         required: false
 *         schema:
 *           type: string
 *           enum: ["0", "1"]
 *         example: "1"
 *         description: Se "1" nasconde i task già eseguiti (execution_state non null)
 *       - in: query
 *         name: macrogroups
 *         required: false
 *         schema:
 *           type: string
 *         example: "1,2,3"
 *         description: >
 *           Lista CSV di cifre iniziali dell'ESWBS_code per filtrare per macrogruppo
 *           (es. "1,2" filtra elementi il cui ESWBS_code inizia con 1 o 2)
 *       - in: query
 *         name: squadre
 *         required: false
 *         schema:
 *           type: string
 *         example: "Alpha,Bravo"
 *         description: Lista CSV di nomi squadra per filtrare i task assegnati
 *       - in: query
 *         name: type_id
 *         required: false
 *         schema:
 *           type: integer
 *         example: 2
 *         description: Filtra per recurrency_type_id
 *     responses:
 *       200:
 *         description: Lista task recuperata con successo
 *         content:
 *           application/json:
 *             example:
 *               tasks:
 *                 - id: 10
 *                   ship_id: 1
 *                   ending_date: "2024-04-01T00:00:00Z"
 *                   execution_state: null
 *                   recurrency_type_id: 2
 *                   maintenance_list:
 *                     id: 3
 *                     Check_List: "1"
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
 *                       ESWBS_code: "1.2.3"
 *                   recurrency_type:
 *                     id: 2
 *                     name: "Mensile"
 *                   vocalNotes: []
 *                   textNotes: []
 *                   photographicNotes: []
 *               total: 42
 *               hasMore: true
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
 *               error: "Error fetching tasks"
 */
router.get("/getTasks", checklistController.getTasks);

/**
 * @swagger
 * /api/checklist/getTypes:
 *   get:
 *     summary: Recupera gli ID dei tipi di manutenzione
 *     description: >
 *       Restituisce gli ID dei recurrencyType corrispondenti a:
 *       "Manutenzioni ordinarie", "Manutenzioni straordinarie",
 *       "Manutenzioni annuali", "Manutenzioni extra"
 *     tags: [Checklist]
 *     responses:
 *       200:
 *         description: Tipi di manutenzione recuperati con successo
 *         content:
 *           application/json:
 *             example:
 *               types: [1, 2, 3, 4]
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Error fetching tasks"
 */
router.get("/getTypes", checklistController.getTypes);

module.exports = router;