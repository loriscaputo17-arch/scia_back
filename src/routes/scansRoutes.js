const express = require("express");
const router = express.Router();
const scansController = require("../controllers/scansController");

/**
 * @swagger
 * tags:
 *   name: Scans
 *   description: Gestione scansioni elementi nave
 */

/**
 * @swagger
 * /api/scans/getScans:
 *   get:
 *     summary: Recupera tutte le scansioni di una nave
 *     description: Restituisce le scansioni filtrate per nave e utente, con elemento e nave associati
 *     tags: [Scans]
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
 *         description: Lista scansioni recuperata con successo
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 ship_id: 1
 *                 user_id: 5
 *                 result: "OK"
 *                 scanned_at: "2024-01-01T00:00:00Z"
 *                 element:
 *                   id: 3
 *                   name: "Motore Principale"
 *                   element_model_id: 10
 *                   ship_id: 1
 *                   serial_number: "SN-001"
 *                   installation_date: "2023-01-01"
 *                   progressive_code: "EL-003"
 *                 ship:
 *                   id: 1
 *                   unit_name: "Nave Aurora"
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
 *               error: "Errore nel recupero delle scans"
 */
router.get("/getScans", scansController.getScans);

/**
 * @swagger
 * /api/scans/saveScan/{scanId}:
 *   put:
 *     summary: Aggiorna il risultato di una scansione
 *     description: Salva il risultato e la data di scansione tramite scanId nel path. I dati vanno nel body.
 *     tags: [Scans]
 *     parameters:
 *       - in: path
 *         name: scanId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID della scansione (usato solo come riferimento URL, il valore effettivo viene dal body)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scanId
 *               - scannedData
 *               - scannedAt
 *             properties:
 *               scanId:
 *                 type: integer
 *                 example: 1
 *                 description: ID della scansione
 *               scannedData:
 *                 type: string
 *                 example: "Nessuna anomalia rilevata"
 *                 description: Risultato della scansione (salvato in result)
 *               scannedAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-03-15T10:30:00Z"
 *                 description: Data e ora della scansione (salvata in scanned_at)
 *     responses:
 *       200:
 *         description: Scansione aggiornata con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Scan aggiornato correttamente."
 *               scan:
 *                 id: 1
 *                 ship_id: 1
 *                 user_id: 5
 *                 result: "Nessuna anomalia rilevata"
 *                 scanned_at: "2024-03-15T10:30:00Z"
 *       400:
 *         description: Parametri obbligatori mancanti
 *         content:
 *           application/json:
 *             example:
 *               error: "Parametri mancanti: scanId, scannedData e scannedAt sono obbligatori."
 *       404:
 *         description: Scansione non trovata
 *         content:
 *           application/json:
 *             example:
 *               error: "Scan non trovato."
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore nel salvataggio dello scan."
 */
router.put("/saveScan/:scanId", scansController.saveScan);
router.post("/createScan", scansController.createScan);

module.exports = router;