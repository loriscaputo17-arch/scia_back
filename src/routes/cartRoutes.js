const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

/**
 * @swagger
 * tags:
 *   name: Cart
 *   description: Gestione carrello ricambi
 */

/**
 * @swagger
 * /api/cart/getProduct:
 *   get:
 *     summary: Recupera i ricambi disponibili
 *     description: Restituisce la lista dei ricambi (Spare), filtrabile per nave
 *     tags: [Cart]
 *     parameters:
 *       - in: query
 *         name: ship_id
 *         required: false
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID della nave (opzionale, se assente restituisce tutti i ricambi)
 *     responses:
 *       200:
 *         description: Lista ricambi recuperata con successo
 *         content:
 *           application/json:
 *             example:
 *               spares:
 *                 - id: 1
 *                   ship_id: 1
 *                   element_model_id: 10
 *                   quantity: 5
 *                   location: 3
 *                   part_id: 2
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore nel recupero dei ricambi"
 */
router.get("/getProduct", cartController.getProduct);

/**
 * @swagger
 * /api/cart/getCart:
 *   get:
 *     summary: Recupera il carrello di un utente
 *     description: >
 *       Restituisce gli elementi nel carrello dell'utente specificato,
 *       con ricambio, modello elemento, parte e organizzazione fornitore annidati
 *     tags: [Cart]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: false
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID utente (opzionale, se assente restituisce tutti i carrelli)
 *     responses:
 *       200:
 *         description: Carrello recuperato con successo
 *         content:
 *           application/json:
 *             example:
 *               cart:
 *                 - id: 1
 *                   user_id: 5
 *                   spare_id: 3
 *                   quantity: 2
 *                   status: "pending"
 *                   spare:
 *                     id: 3
 *                     quantity: 10
 *                     elementModel:
 *                       id: 10
 *                       name: "Modello Motore X"
 *                     part:
 *                       id: 2
 *                       organizationCompanyNCAGE:
 *                         id: 4
 *                         name: "Fornitore XYZ"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore nel recupero del carrello"
 */
router.get("/getCart", cartController.getCart);

/**
 * @swagger
 * /api/cart/addProduct:
 *   post:
 *     summary: Aggiunge un ricambio al carrello
 *     description: >
 *       Aggiunge un ricambio al carrello dell'utente. Se il ricambio è già presente
 *       (stessa coppia spare_id + user_id), incrementa la quantità e aggiorna lo stato
 *     tags: [Cart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - spare_id
 *               - user_id
 *               - quantity
 *               - status
 *             properties:
 *               spare_id:
 *                 type: integer
 *                 example: 3
 *                 description: ID del ricambio
 *               user_id:
 *                 type: integer
 *                 example: 5
 *                 description: ID utente
 *               quantity:
 *                 type: integer
 *                 example: 2
 *                 description: Quantità da aggiungere
 *               status:
 *                 type: string
 *                 example: "pending"
 *                 description: Stato dell'elemento nel carrello
 *     responses:
 *       200:
 *         description: Prodotto già presente, quantità aggiornata
 *         content:
 *           application/json:
 *             example:
 *               message: "Prodotto aggiornato nel carrello"
 *               cartItem:
 *                 id: 1
 *                 spare_id: 3
 *                 user_id: 5
 *                 quantity: 4
 *                 status: "pending"
 *       201:
 *         description: Prodotto aggiunto al carrello
 *         content:
 *           application/json:
 *             example:
 *               message: "Prodotto aggiunto al carrello"
 *               cartItem:
 *                 id: 10
 *                 spare_id: 3
 *                 user_id: 5
 *                 quantity: 2
 *                 status: "pending"
 *       400:
 *         description: Campi obbligatori mancanti
 *         content:
 *           application/json:
 *             example:
 *               error: "Tutti i campi sono obbligatori."
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore durante l'aggiunta al carrello"
 */
router.post("/addProduct", cartController.addProduct);

/**
 * @swagger
 * /api/cart/updateProduct/{id}:
 *   put:
 *     summary: Aggiorna un elemento nel carrello
 *     description: >
 *       Aggiorna quantity e/o status di un elemento nel carrello.
 *       Il parametro id nel path è lo spare_id (non l'id del record Cart)
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *         description: spare_id del ricambio da aggiornare nel carrello
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: integer
 *                 example: 5
 *                 description: Nuova quantità (opzionale)
 *               status:
 *                 type: string
 *                 example: "ordered"
 *                 description: Nuovo stato (opzionale)
 *     responses:
 *       200:
 *         description: Prodotto aggiornato con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Prodotto aggiornato"
 *               cartItem:
 *                 id: 1
 *                 spare_id: 3
 *                 user_id: 5
 *                 quantity: 5
 *                 status: "ordered"
 *       404:
 *         description: Prodotto non trovato nel carrello
 *         content:
 *           application/json:
 *             example:
 *               error: "Prodotto non trovato nel carrello"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore interno"
 */
router.put("/updateProduct/:id", cartController.updateProduct);

/**
 * @swagger
 * /api/cart/removeProduct/{id}:
 *   delete:
 *     summary: Rimuove un elemento dal carrello
 *     description: >
 *       Elimina definitivamente un elemento dal carrello.
 *       Il parametro id nel path è lo spare_id (non l'id del record Cart)
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *         description: spare_id del ricambio da rimuovere dal carrello
 *     responses:
 *       200:
 *         description: Prodotto rimosso con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Prodotto rimosso dal carrello"
 *       404:
 *         description: Prodotto non trovato nel carrello
 *         content:
 *           application/json:
 *             example:
 *               error: "Prodotto non trovato nel carrello"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore interno"
 */
router.delete("/removeProduct/:id", cartController.removeProduct);

module.exports = router;