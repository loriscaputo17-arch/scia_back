const multer = require('multer');
const express = require("express");
const router = express.Router();
const spareController = require("../controllers/spareController");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * @swagger
 * tags:
 *   name: Spares
 *   description: Gestione ricambi (spares)
 */

/**
 * @swagger
 * /api/spare/getSpare:
 *   get:
 *     summary: Recupera spare filtrati
 *     tags: [Spares]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         example: filtro
 *       - in: query
 *         name: id
 *         schema:
 *           type: integer
 *         example: 10
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 2
 *     responses:
 *       200:
 *         description: Lista spares
 *         content:
 *           application/json:
 *             example:
 *               spares: []
 *       500:
 *         description: Errore server
 */
router.get("/getSpare", spareController.getSpare);

/**
 * @swagger
 * /api/spare/getSpares:
 *   get:
 *     summary: Lista spares paginata e filtrata
 *     tags: [Spares]
 *     parameters:
 *       - in: query
 *         name: ship_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 30
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: filtro
 *       - in: query
 *         name: eswbs_code
 *         schema:
 *           type: string
 *         example: 123
 *       - in: query
 *         name: inGiacenza
 *         schema:
 *           type: string
 *           enum: ["0","1"]
 *       - in: query
 *         name: nonDisponibile
 *         schema:
 *           type: string
 *           enum: ["0","1"]
 *       - in: query
 *         name: magazzino
 *         schema:
 *           type: string
 *         example: onboard,dockside
 *     responses:
 *       200:
 *         description: Lista spares paginata
 *         content:
 *           application/json:
 *             example:
 *               spares: []
 *               total: 100
 *               hasMore: true
 *       400:
 *         description: ship_id mancante
 *       500:
 *         description: Errore server
 */
router.get("/getSpares", spareController.getSpares);

/**
 * @swagger
 * /api/spare/updateSpare/{id}:
 *   put:
 *     summary: Aggiorna uno spare
 *     tags: [Spares]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             quantity: 10
 *             location_onboard: A1
 *             eswbs: 123
 *     responses:
 *       200:
 *         description: Spare aggiornato
 *       404:
 *         description: Spare non trovato
 */
router.put("/updateSpare/:id", spareController.updateSpare);

/**
 * @swagger
 * /api/spare/moveSpare/{id}:
 *   put:
 *     summary: Sposta uno spare
 *     tags: [Spares]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             ship_id: 1
 *             user_id: 5
 *             updateData:
 *               locationData:
 *                 - newLocation: "A1"
 *                   quantity: 5
 *     responses:
 *       200:
 *         description: Spare spostato
 */
router.put("/moveSpare/:id", spareController.moveSpare);

/**
 * @swagger
 * /api/spare/fetchSpareById:
 *   get:
 *     summary: Cerca spare per ean13, partNumber o eswbs
 *     tags: [Spares]
 *     parameters:
 *       - in: query
 *         name: ean13
 *         schema:
 *           type: string
 *       - in: query
 *         name: partNumber
 *         schema:
 *           type: string
 *       - in: query
 *         name: eswbsSearch
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Spare trovati
 */
router.get("/fetchSpareById", spareController.fetchSpareById);

/**
 * @swagger
 * /api/spare/submitProduct:
 *   post:
 *     summary: Crea nuovo spare
 *     tags: [Spares]
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             quantity: 10
 *             eswbs: 123
 *             ship_id: 1
 *             user_id: 5
 *             originalName: Filtro
 *     responses:
 *       201:
 *         description: Spare creato
 */
router.post("/submitProduct", spareController.submitProduct);

/**
 * @swagger
 * /api/spare/uploadProductImage:
 *   post:
 *     summary: Upload immagine prodotto
 *     tags: [Spares]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               partNumber:
 *                 type: string
 *               originalName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Immagine caricata
 */
router.post("/uploadProductImage", upload.single("file"), spareController.uploadProductImage);

/**
 * @swagger
 * /api/spare/{maintenanceList_id}/spares:
 *   post:
 *     summary: Aggiunge spare a maintenance list
 *     tags: [Spares]
 *     parameters:
 *       - in: path
 *         name: maintenanceList_id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               brand:
 *                 type: string
 *               model:
 *                 type: string
 *               part_number:
 *                 type: string
 *               description:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Spare aggiunto
 */
router.post("/:maintenanceList_id/spares", upload.single("file"), spareController.addSpareMaintenanceList);
module.exports = router;