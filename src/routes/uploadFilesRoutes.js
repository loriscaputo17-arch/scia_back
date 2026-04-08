const multer = require('multer');
const express = require("express");
const router = express.Router();
const uploadFilesController = require("../controllers/uploadFilesController");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * @swagger
 * tags:
 *   name: UploadFiles
 *   description: Upload e recupero di file multimediali (foto, audio, note testuali)
 */

// ─── FAILURE NOTES ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/uploadFiles/uploadPhoto:
 *   post:
 *     summary: Carica una foto legata a una failure
 *     tags: [UploadFiles]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File immagine da caricare
 *     responses:
 *       200:
 *         description: Foto caricata con successo
 *       400:
 *         description: File mancante o non valido
 *       500:
 *         description: Errore server
 */
router.post("/uploadPhoto", upload.single("file"), uploadFilesController.uploadPhoto);

/**
 * @swagger
 * /api/uploadFiles/uploadAudio:
 *   post:
 *     summary: Carica un audio legato a una failure
 *     tags: [UploadFiles]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File audio da caricare
 *     responses:
 *       200:
 *         description: Audio caricato con successo
 *       400:
 *         description: File mancante o non valido
 *       500:
 *         description: Errore server
 */
router.post("/uploadAudio", upload.single("file"), uploadFilesController.uploadAudio);

/**
 * @swagger
 * /api/uploadFiles/uploadText:
 *   post:
 *     summary: Carica una nota testuale legata a una failure
 *     tags: [UploadFiles]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 format: binary
 *                 description: File di testo da caricare
 *     responses:
 *       200:
 *         description: Nota testuale caricata con successo
 *       400:
 *         description: Contenuto mancante
 *       500:
 *         description: Errore server
 */
router.post("/uploadText", upload.single("content"), uploadFilesController.uploadTextNote);

/**
 * @swagger
 * /api/uploadFiles/getAudios/{failureId}/{type}:
 *   get:
 *     summary: Recupera gli audio di una failure
 *     tags: [UploadFiles]
 *     parameters:
 *       - in: path
 *         name: failureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della failure
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Tipo/categoria del file
 *     responses:
 *       200:
 *         description: Lista degli audio
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 url: "https://..."
 *                 createdAt: "2024-01-01T00:00:00Z"
 *       404:
 *         description: Nessun audio trovato
 *       500:
 *         description: Errore server
 */
router.get("/getAudios/:failureId/:type", uploadFilesController.getAudios);

/**
 * @swagger
 * /api/uploadFiles/getPhotos/{failureId}/{type}:
 *   get:
 *     summary: Recupera le foto di una failure
 *     tags: [UploadFiles]
 *     parameters:
 *       - in: path
 *         name: failureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della failure
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Tipo/categoria del file
 *     responses:
 *       200:
 *         description: Lista delle foto
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 url: "https://..."
 *                 createdAt: "2024-01-01T00:00:00Z"
 *       404:
 *         description: Nessuna foto trovata
 *       500:
 *         description: Errore server
 */
router.get("/getPhotos/:failureId/:type", uploadFilesController.getPhotos);

/**
 * @swagger
 * /api/uploadFiles/getTextNotes/{failureId}/{type}:
 *   get:
 *     summary: Recupera le note testuali di una failure
 *     tags: [UploadFiles]
 *     parameters:
 *       - in: path
 *         name: failureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della failure
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Tipo/categoria del file
 *     responses:
 *       200:
 *         description: Lista delle note testuali
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 content: "Nota di esempio"
 *                 createdAt: "2024-01-01T00:00:00Z"
 *       404:
 *         description: Nessuna nota trovata
 *       500:
 *         description: Errore server
 */
router.get("/getTextNotes/:failureId/:type", uploadFilesController.getTextNotes);

// ─── GENERAL NOTES ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/uploadFiles/uploadPhotoGeneral:
 *   post:
 *     summary: Carica una foto generica (non legata a una failure)
 *     tags: [UploadFiles]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Foto caricata con successo
 *       400:
 *         description: File mancante
 *       500:
 *         description: Errore server
 */
router.post("/uploadPhotoGeneral", upload.single("file"), uploadFilesController.uploadPhotoGeneral);

/**
 * @swagger
 * /api/uploadFiles/uploadAudioGeneral:
 *   post:
 *     summary: Carica un audio generico (non legato a una failure)
 *     tags: [UploadFiles]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Audio caricato con successo
 *       400:
 *         description: File mancante
 *       500:
 *         description: Errore server
 */
router.post("/uploadAudioGeneral", upload.single("file"), uploadFilesController.uploadAudioGeneral);

/**
 * @swagger
 * /api/uploadFiles/uploadTextGeneral:
 *   post:
 *     summary: Carica una nota testuale generica (non legata a una failure)
 *     tags: [UploadFiles]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Nota caricata con successo
 *       400:
 *         description: Contenuto mancante
 *       500:
 *         description: Errore server
 */
router.post("/uploadTextGeneral", upload.single("content"), uploadFilesController.uploadTextNoteGeneral);

/**
 * @swagger
 * /api/uploadFiles/getAudiosGeneral/{failureId}/{type}:
 *   get:
 *     summary: Recupera gli audio generici
 *     tags: [UploadFiles]
 *     parameters:
 *       - in: path
 *         name: failureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID di riferimento
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Tipo/categoria
 *     responses:
 *       200:
 *         description: Lista degli audio generici
 *       404:
 *         description: Nessun audio trovato
 *       500:
 *         description: Errore server
 */
router.get("/getAudiosGeneral/:failureId/:type", uploadFilesController.getAudiosGeneral);

/**
 * @swagger
 * /api/uploadFiles/getPhotosGeneral/{failureId}/{type}:
 *   get:
 *     summary: Recupera le foto generiche
 *     tags: [UploadFiles]
 *     parameters:
 *       - in: path
 *         name: failureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID di riferimento
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Tipo/categoria
 *     responses:
 *       200:
 *         description: Lista delle foto generiche
 *       404:
 *         description: Nessuna foto trovata
 *       500:
 *         description: Errore server
 */
router.get("/getPhotosGeneral/:failureId/:type", uploadFilesController.getPhotosGeneral);

/**
 * @swagger
 * /api/uploadFiles/getTextNotesGeneral/{failureId}/{type}:
 *   get:
 *     summary: Recupera le note testuali generiche
 *     tags: [UploadFiles]
 *     parameters:
 *       - in: path
 *         name: failureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID di riferimento
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Tipo/categoria
 *     responses:
 *       200:
 *         description: Lista delle note testuali generiche
 *       404:
 *         description: Nessuna nota trovata
 *       500:
 *         description: Errore server
 */
router.get("/getTextNotesGeneral/:failureId/:type", uploadFilesController.getTextNotesGeneral);

module.exports = router;