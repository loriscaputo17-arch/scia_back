const express = require("express");
const router = express.Router();
const summaryController = require("../controllers/summaryController");

/**
 * @swagger
 * tags:
 *   name: Summary
 *   description: Dashboard riepilogo dati nave
 */

/**
 * @swagger
 * /api/summary:
 *   get:
 *     summary: Ottiene il riepilogo dashboard della nave
 *     description: Restituisce contatori e ultimi record (maintenance, checklist, readings, spares, failures, files)
 *     tags: [Summary]
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
 *         description: Riepilogo dashboard
 *         content:
 *           application/json:
 *             example:
 *               counters:
 *                 maintenance: 10
 *                 checklist: 5
 *                 readings: 20
 *                 spares: 50
 *                 failures: 2
 *                 files: 8
 *               last:
 *                 maintenance: []
 *                 checklist: []
 *                 readings: []
 *                 spares: []
 *                 failures: []
 *                 files: []
 *       400:
 *         description: ship_id o user_id mancanti
 *       500:
 *         description: Errore server
 */
router.get("/", summaryController.getSummary);
 
module.exports = router;
