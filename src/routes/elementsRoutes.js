const express = require("express");
const router = express.Router();
const elementController = require("../controllers/elementController");

/**
 * @swagger
 * tags:
 *   name: Elements
 *   description: Gestione elementi nave
 */

/**
 * @swagger
 * /api/element/addTimeWork:
 *   post:
 *     summary: Aggiorna il tempo di lavoro di un elemento
 *     description: Salva il valore time_to_work per l'elemento specificato
 *     tags: [Elements]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - time
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 5
 *                 description: ID dell'elemento
 *               time:
 *                 type: number
 *                 example: 120
 *                 description: Tempo di lavoro da salvare (in ore o minuti)
 *     responses:
 *       200:
 *         description: Tempo di lavoro aggiornato con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Element timeWork updated"
 *               element:
 *                 id: 5
 *                 name: "Motore Principale"
 *                 time_to_work: 120
 *                 updated_at: "2024-03-15T10:30:00Z"
 *       404:
 *         description: Elemento non trovato
 *         content:
 *           application/json:
 *             example:
 *               error: "Element not found"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Error updating element timeWork"
 */
router.post("/addTimeWork", elementController.addElementTimeWork);

/**
 * @swagger
 * /api/element/updateElement/{elementId}:
 *   get:
 *     summary: Aggiorna un elemento esistente
 *     description: >
 *       Attenzione: questa route è registrata come GET ma esegue un aggiornamento
 *       tramite req.body. Aggiorna qualsiasi campo del modello Element passato nel body.
 *     tags: [Elements]
 *     parameters:
 *       - in: path
 *         name: elementId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID dell'elemento da aggiornare
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Motore Aggiornato"
 *                 description: Nome dell'elemento
 *               serial_number:
 *                 type: string
 *                 example: "SN-002"
 *                 description: Numero seriale
 *               installation_date:
 *                 type: string
 *                 format: date
 *                 example: "2023-06-01"
 *                 description: Data di installazione
 *     responses:
 *       200:
 *         description: Elemento aggiornato con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Element successfully updated"
 *       404:
 *         description: Elemento non trovato
 *         content:
 *           application/json:
 *             example:
 *               error: "Element not found"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Error updating element"
 */
router.get("/updateElement/:elementId", elementController.updateElement);

/**
 * @swagger
 * /api/element/getElements/{ship_model_id}/{user_id}:
 *   post:
 *     summary: Recupera gli elementi di una nave in struttura ad albero
 *     description: >
 *       Restituisce gli elementi della nave specificata organizzati in un albero gerarchico
 *       basato su parent_element_model_id. Filtrabile per teamId e lcnTypes nel body.
 *     tags: [Elements]
 *     parameters:
 *       - in: path
 *         name: ship_model_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID del modello nave (usato per trovare la Ship)
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID utente
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               teamId:
 *                 type: integer
 *                 example: 2
 *                 description: Filtra la nave per team (opzionale)
 *               lcnTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["type1", "type2"]
 *                 description: Filtra gli elementi per lcn_type (opzionale)
 *     responses:
 *       200:
 *         description: Albero elementi recuperato con successo
 *         content:
 *           application/json:
 *             example:
 *               - id: "1"
 *                 name: "Sistema Propulsione"
 *                 code: "SN-001"
 *                 LCNtype_ID: 1
 *                 eswbs_code: "ESW-001"
 *                 element_model_id: 10
 *                 parent_element_model_id: null
 *                 children:
 *                   - id: "3"
 *                     name: "Motore Principale"
 *                     code: "SN-003"
 *                     LCNtype_ID: 2
 *                     eswbs_code: "ESW-003"
 *                     element_model_id: 12
 *                     parent_element_model_id: 10
 *                     children: []
 *       404:
 *         description: Nave o elementi non trovati
 *         content:
 *           application/json:
 *             example:
 *               error: "No elements found"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Server error while retrieving elements"
 */
router.post("/getElements/:ship_model_id/:user_id", elementController.getElements);


/**
 * @swagger
 * /api/element/getElements/{ship_model_id}/{user_id}:
 *   post:
 *     summary: Recupera gli elementi di una nave in struttura ad albero
 *     description: >
 *       Restituisce gli elementi della nave specificata organizzati in un albero gerarchico
 *       basato su parent_element_model_id. Filtrabile per teamId e lcnTypes nel body.
 *     tags: [Elements]
 *     parameters:
 *       - in: path
 *         name: ship_model_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID del modello nave (usato per trovare la Ship)
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID utente
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               teamId:
 *                 type: integer
 *                 example: 2
 *                 description: Filtra la nave per team (opzionale)
 *               lcnTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["type1", "type2"]
 *                 description: Filtra gli elementi per lcn_type (opzionale)
 *     responses:
 *       200:
 *         description: Albero elementi recuperato con successo
 *         content:
 *           application/json:
 *             example:
 *               - id: "1"
 *                 name: "Sistema Propulsione"
 *                 code: "SN-001"
 *                 LCNtype_ID: 1
 *                 eswbs_code: "ESW-001"
 *                 element_model_id: 10
 *                 parent_element_model_id: null
 *                 children:
 *                   - id: "3"
 *                     name: "Motore Principale"
 *                     code: "SN-003"
 *                     LCNtype_ID: 2
 *                     eswbs_code: "ESW-003"
 *                     element_model_id: 12
 *                     parent_element_model_id: 10
 *                     children: []
 *       404:
 *         description: Nave o elementi non trovati
 *         content:
 *           application/json:
 *             example:
 *               error: "No elements found"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Server error while retrieving elements"
 */
router.post("/getElementsToPrint/:ship_model_id/:user_id", elementController.getElementsToPrint);

/**
 * @swagger
 * /api/element/getElement:
 *   post:
 *     summary: Recupera il dettaglio completo di un elemento
 *     description: >
 *       Restituisce tutti i dati relativi a un elemento: modello, gerarchia padre/figli,
 *       ricambi, manutenzioni, job executions, letture, scansioni, guasti, file nave,
 *       produttore, fornitore e note (vocali, testuali, fotografiche) con signed URL S3
 *     tags: [Elements]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - element
 *               - ship_id
 *             properties:
 *               element:
 *                 type: integer
 *                 example: 5
 *                 description: ID dell'elemento
 *               ship_id:
 *                 type: integer
 *                 example: 1
 *                 description: ID della nave
 *     responses:
 *       200:
 *         description: Dettaglio elemento recuperato con successo
 *         content:
 *           application/json:
 *             example:
 *               element:
 *                 id: 5
 *                 name: "Motore Principale"
 *                 ship_id: 1
 *                 element_model_id: 10
 *                 serial_number: "SN-001"
 *                 installation_date: "2023-01-01"
 *                 progressive_code: "EL-005"
 *                 time_to_work: 120
 *               model:
 *                 id: 10
 *                 name: "Modello Motore X"
 *                 parent_element_model_id: 3
 *                 Manufacturer_ID: 2
 *                 Supplier_ID: 4
 *               parent:
 *                 element:
 *                   id: 2
 *                   name: "Sistema Propulsione"
 *                 model:
 *                   id: 3
 *                   name: "Modello Sistema"
 *               children:
 *                 - element:
 *                     id: 8
 *                     name: "Valvola A"
 *                   model:
 *                     id: 14
 *                     name: "Modello Valvola"
 *               spares:
 *                 - id: 1
 *                   element_model_id: 10
 *                   quantity: 5
 *                   part:
 *                     id: 2
 *                     organizationCompanyNCAGE:
 *                       id: 3
 *                       name: "Fornitore XYZ"
 *               maintenances:
 *                 - id: 1
 *                   maintenance_level:
 *                     name: "Livello 1"
 *                   recurrency_type:
 *                     name: "Mensile"
 *               jobExecutions:
 *                 - id: 10
 *                   ending_date: "2024-04-01T00:00:00Z"
 *                   status:
 *                     name: "Completato"
 *                   recurrency_type:
 *                     name: "Mensile"
 *               readings:
 *                 - id: 1
 *                   due_date: "2024-03-01T00:00:00Z"
 *                   type:
 *                     name: "Pressione"
 *               scans:
 *                 - id: 1
 *                   scanned_at: "2024-02-01T00:00:00Z"
 *                   result: "OK"
 *               failures:
 *                 - id: 1
 *                   title: "Guasto valvola"
 *                   gravity: "high"
 *               shipFiles:
 *                 - id: 1
 *                   ship_id: 1
 *                   file_url: "https://..."
 *               manufacturer:
 *                 id: 2
 *                 organizationCompanyNCAGE:
 *                   name: "Produttore ABC"
 *               supplier:
 *                 id: 4
 *                 name: "Fornitore XYZ"
 *               notes:
 *                 vocal:
 *                   - id: 1
 *                     audio_url: "https://signed-s3-url..."
 *                     author: 5
 *                     authorDetails:
 *                       id: 5
 *                       first_name: "Mario"
 *                       last_name: "Rossi"
 *                 text:
 *                   - id: 2
 *                     content: "Nota testuale"
 *                     author: 5
 *                     authorDetails:
 *                       id: 5
 *                       first_name: "Mario"
 *                       last_name: "Rossi"
 *                 photos:
 *                   - id: 3
 *                     image_url: "https://signed-s3-url..."
 *                     author: 5
 *                     authorDetails:
 *                       id: 5
 *                       first_name: "Mario"
 *                       last_name: "Rossi"
 *       400:
 *         description: Parametri obbligatori mancanti
 *         content:
 *           application/json:
 *             example:
 *               error: "Missing element or ship_id in request body"
 *       404:
 *         description: Elemento o modello non trovato
 *         content:
 *           application/json:
 *             example:
 *               error: "Element not found"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal server error"
 */
router.post("/getElement", elementController.getElement);

router.post("/:ship_model_id/dymo-export", elementController.exportDymoExcel);

module.exports = router;