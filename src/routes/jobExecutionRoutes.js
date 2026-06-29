const express = require("express");
const router = express.Router();
const jobExecutionController = require("../controllers/jobExecutionController");

/**
 * @swagger
 * /jobs-executions/execution/{executionId}:
 *   get:
 *     summary: Recupera il dettaglio di una singola esecuzione
 *     description: Restituisce i dati grezzi di una JobExecution tramite il suo ID
 *     tags: [JobExecutions]
 *     parameters:
 *       - in: path
 *         name: executionId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID dell'esecuzione
 *     responses:
 *       200:
 *         description: Esecuzione recuperata con successo
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               job_id: 3
 *               element_id: 5
 *               status_id: 2
 *               createdAt: "2024-01-01T00:00:00Z"
 *               updatedAt: "2024-01-02T00:00:00Z"
 *       404:
 *         description: Esecuzione non trovata
 *         content:
 *           application/json:
 *             example:
 *               message: "Esecuzione non trovata"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Messaggio errore"
 */
router.get("/execution/:executionId", jobExecutionController.getExecutionById);

/**
 * @swagger
 * /jobs-executions/execution:
 *   post:
 *     summary: Crea una nuova esecuzione
 *     description: Crea un nuovo record JobExecution con i dati forniti nel body
 *     tags: [JobExecutions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               job_id:
 *                 type: integer
 *                 example: 3
 *                 description: ID del job
 *               element_id:
 *                 type: integer
 *                 example: 5
 *                 description: ID dell'elemento
 *               status_id:
 *                 type: integer
 *                 example: 2
 *                 description: ID dello stato
 *     responses:
 *       201:
 *         description: Esecuzione creata con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Esecuzione creata con successo"
 *               executionId: 10
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Messaggio errore"
 */
router.post("/execution", jobExecutionController.createExecution);

/**
 * @swagger
 * /jobs-executions/execution/{executionId}:
 *   put:
 *     summary: Aggiorna un'esecuzione esistente
 *     description: Aggiorna i campi di una JobExecution tramite il suo ID. Il body può contenere qualsiasi campo del modello.
 *     tags: [JobExecutions]
 *     parameters:
 *       - in: path
 *         name: executionId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID dell'esecuzione da aggiornare
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               job_id:
 *                 type: integer
 *                 example: 3
 *                 description: ID del job
 *               element_id:
 *                 type: integer
 *                 example: 5
 *                 description: ID dell'elemento
 *               status_id:
 *                 type: integer
 *                 example: 2
 *                 description: ID dello stato
 *     responses:
 *       200:
 *         description: Esecuzione aggiornata con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Esecuzione aggiornata con successo"
 *       404:
 *         description: Esecuzione non trovata
 *         content:
 *           application/json:
 *             example:
 *               message: "Esecuzione non trovata"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Messaggio errore"
 */
router.put("/execution/:executionId", jobExecutionController.updateExecution);

/**
 * @swagger
 * /jobs-executions/execution/{executionId}:
 *   delete:
 *     summary: Elimina un'esecuzione
 *     description: Elimina definitivamente una JobExecution tramite il suo ID
 *     tags: [JobExecutions]
 *     parameters:
 *       - in: path
 *         name: executionId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID dell'esecuzione da eliminare
 *     responses:
 *       200:
 *         description: Esecuzione eliminata con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Esecuzione eliminata con successo"
 *       404:
 *         description: Esecuzione non trovata
 *         content:
 *           application/json:
 *             example:
 *               message: "Esecuzione non trovata"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Messaggio errore"
 */
router.delete("/execution/:executionId", jobExecutionController.deleteExecution);

module.exports = router;