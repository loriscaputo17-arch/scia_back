const express = require("express");
const router = express.Router();
const shipFilesController = require("../controllers/shipFilesController");

/**
 * @swagger
 * tags:
 *   name: ShipFiles
 *   description: Gestione file delle navi
 */

/**
 * @swagger
 * /api/shipFiles/getFiles:
 *   get:
 *     summary: Recupera tutti i file della nave
 *     description: Restituisce la lista dei file associati a una nave con URL firmati S3
 *     tags: [ShipFiles]
 *     parameters:
 *       - in: query
 *         name: ship_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della nave
 *         example: 1
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filtra per utente
 *         example: 5
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Ricerca per nome file
 *         example: manuale
 *       - in: query
 *         name: file_type
 *         schema:
 *           type: string
 *         description: Tipo MIME del file
 *         example: application/pdf
 *     responses:
 *       200:
 *         description: Lista dei file recuperata con successo
 *         content:
 *           application/json:
 *             example:
 *               total: 2
 *               files:
 *                 - id: 1
 *                   ship_id: 1
 *                   user_id: 5
 *                   file_name: manuale.pdf
 *                   file_type: application/pdf
 *                   file_link: https://signed-url-s3
 *                   uploaded_at: 2024-01-01T10:00:00.000Z
 *                 - id: 2
 *                   ship_id: 1
 *                   user_id: 3
 *                   file_name: foto.jpg
 *                   file_type: image/jpeg
 *                   file_link: https://signed-url-s3
 *                   uploaded_at: 2024-01-02T12:00:00.000Z
 *       400:
 *         description: Parametri mancanti o non validi
 *       500:
 *         description: Errore del server
 */
router.get("/getFiles", shipFilesController.getFiles);

/**
 * @swagger
 * /api/shipFiles/uploadShipFile:
 *   post:
 *     summary: Carica un file per la nave
 *     description: Upload di un file su S3 e salvataggio nel database
 *     tags: [ShipFiles]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - ship_id
 *               - user_id
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File da caricare
 *               ship_id:
 *                 type: integer
 *                 example: 1
 *               user_id:
 *                 type: integer
 *                 example: 5
 *               description:
 *                 type: string
 *                 example: Documento tecnico nave
 *     responses:
 *       200:
 *         description: File caricato con successo
 *         content:
 *           application/json:
 *             example:
 *               message: File caricato con successo
 *               file:
 *                 id: 10
 *                 ship_id: 1
 *                 user_id: 5
 *                 file_name: manuale.pdf
 *                 file_type: application/pdf
 *                 file_link: ships/1/123456-manuale.pdf
 *                 uploaded_at: 2024-01-01T10:00:00.000Z
 *       400:
 *         description: Richiesta non valida (file o parametri mancanti)
 *       500:
 *         description: Errore durante upload file
 */
router.post(
  "/uploadShipFile",
  shipFilesController.uploadMiddleware,
  shipFilesController.uploadShipFile
);

router.post("/createFolder", shipFilesController.createFolder);
router.get("/tree/:ship_id", shipFilesController.getFileTree);

module.exports = router;