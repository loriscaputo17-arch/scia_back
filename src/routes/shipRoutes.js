const express = require("express");
const router = express.Router();
const shipController = require("../controllers/shipController");

/**
 * @swagger
 * tags:
 *   name: Ships
 *   description: Gestione navi
 */

/**
 * @swagger
 * /api/ships/ships:
 *   get:
 *     summary: Recupera tutte le navi
 *     tags: [Ships]
 *     responses:
 *       200:
 *         description: Lista delle navi
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 name: Titanic
 *                 type: Cargo
 *               - id: 2
 *                 name: Queen Mary
 *                 type: Cruise
 *       500:
 *         description: Errore del server
 */
router.get("/ships", shipController.getAllShips);

/**
 * @swagger
 * /api/ships/ships/{id}:
 *   get:
 *     summary: Recupera una nave per ID
 *     tags: [Ships]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della nave
 *     responses:
 *       200:
 *         description: Nave trovata
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               name: Titanic
 *               type: Cargo
 *       404:
 *         description: Nave non trovata
 *       500:
 *         description: Errore del server
 */
router.get("/ships/:id", shipController.getShipById);

/**
 * @swagger
 * /api/ships/ships:
 *   post:
 *     summary: Crea una nuova nave
 *     tags: [Ships]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Titanic
 *               type:
 *                 type: string
 *                 example: Cargo
 *     responses:
 *       201:
 *         description: Nave creata con successo
 *         content:
 *           application/json:
 *             example:
 *               message: Ship successfully created
 *               ship:
 *                 id: 1
 *                 name: Titanic
 *                 type: Cargo
 *       500:
 *         description: Errore del server
 */
router.post("/ships", shipController.createShip);

/**
 * @swagger
 * /api/ships/ships/{id}:
 *   put:
 *     summary: Aggiorna una nave
 *     tags: [Ships]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della nave
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: Titanic Updated
 *             type: Cargo
 *     responses:
 *       200:
 *         description: Nave aggiornata con successo
 *         content:
 *           application/json:
 *             example:
 *               message: Ship successfully updated
 *       404:
 *         description: Nave non trovata
 *       500:
 *         description: Errore del server
 */
router.put("/ships/:id", shipController.updateShip);

/**
 * @swagger
 * /api/ships/ships/{id}:
 *   delete:
 *     summary: Elimina una nave
 *     tags: [Ships]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della nave
 *     responses:
 *       200:
 *         description: Nave eliminata con successo
 *         content:
 *           application/json:
 *             example:
 *               message: Ship successfully deleted
 *       404:
 *         description: Nave non trovata
 *       500:
 *         description: Errore del server
 */
router.delete("/ships/:id", shipController.deleteShip);

module.exports = router;