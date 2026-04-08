const multer = require('multer');
const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: Gestione profilo utente
 */

/**
 * @swagger
 * /api/profile/getProfile:
 *   get:
 *     summary: Recupera il profilo dell'utente corrente
 *     description: Restituisce i dati del profilo tramite Bearer token JWT
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profilo recuperato con successo
 *         content:
 *           application/json:
 *             example:
 *               id: 5
 *               firstName: "Mario"
 *               lastName: "Rossi"
 *               email: "mario.rossi@example.com"
 *               role: "Admin"
 *               type: "crew"
 *               rank: "Captain"
 *               profileImage: "https://signed-url..."
 *               phoneNumber: "+39 333 1234567"
 *               registrationDate: "2024-01-01T00:00:00Z"
 *               botIds:
 *                 ita: "bot_ita_123"
 *                 ing: "bot_ing_123"
 *                 esp: "bot_esp_123"
 *               teamInfo:
 *                 teamMemberId: 1
 *                 userId: 5
 *                 teamId: 2
 *                 teamName: "Team Alpha"
 *                 teamLeader:
 *                   id: 3
 *                   firstName: "Luca"
 *                   lastName: "Bianchi"
 *                 assignedShip:
 *                   id: 1
 *                   unitName: "Nave Aurora"
 *                   unitCode: "NA-001"
 *                   shipModelId: 10
 *                   sideShipNumber: "SS-42"
 *       401:
 *         description: Token mancante o non valido
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized: Token missing"
 *       404:
 *         description: Utente o ruolo non trovato
 *         content:
 *           application/json:
 *             example:
 *               error: "User not found"
 *       500:
 *         description: Errore server
 */
router.get("/getProfile", profileController.getProfile);

/**
 * @swagger
 * /api/profile/getProfileById/{id}:
 *   get:
 *     summary: Recupera il profilo di un utente tramite ID
 *     description: Restituisce i dati del profilo dell'utente specificato, richiede Bearer token JWT
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID dell'utente
 *     responses:
 *       200:
 *         description: Profilo recuperato con successo
 *         content:
 *           application/json:
 *             example:
 *               id: 5
 *               firstName: "Mario"
 *               lastName: "Rossi"
 *               rank: "Captain"
 *               type: "crew"
 *               role: "Admin"
 *               profileImage: "https://signed-url..."
 *               email: "mario.rossi@example.com"
 *               phoneNumber: "+39 333 1234567"
 *               registrationDate: "2024-01-01T00:00:00Z"
 *               team:
 *                 id: 2
 *                 name: "Team Alpha"
 *               teamLeader:
 *                 firstName: "Luca"
 *                 lastName: "Bianchi"
 *       401:
 *         description: Token mancante o non valido
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized"
 *       404:
 *         description: Utente o ruolo non trovato
 *         content:
 *           application/json:
 *             example:
 *               error: "User not found"
 *       500:
 *         description: Errore server
 */
router.get("/getProfileById/:id", profileController.getProfileById);

/**
 * @swagger
 * /api/profile/updateProfile:
 *   post:
 *     summary: Aggiorna il profilo utente
 *     description: Aggiorna i dati anagrafici dell'utente (nome, cognome, email, telefono, rank)
 *     tags: [Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 5
 *                 description: ID dell'utente
 *               firstName:
 *                 type: string
 *                 example: "Mario"
 *               lastName:
 *                 type: string
 *                 example: "Rossi"
 *               email:
 *                 type: string
 *                 example: "mario.rossi@example.com"
 *               phoneNumber:
 *                 type: string
 *                 example: "+39 333 1234567"
 *               rank:
 *                 type: string
 *                 example: "Captain"
 *     responses:
 *       200:
 *         description: Profilo aggiornato con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Profile updated successfully"
 *       400:
 *         description: userId mancante
 *         content:
 *           application/json:
 *             example:
 *               error: "User ID is required"
 *       404:
 *         description: Utente non trovato
 *         content:
 *           application/json:
 *             example:
 *               error: "User not found"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal server error"
 */
router.post("/updateProfile", profileController.updateProfile);

/**
 * @swagger
 * /api/profile/uploadProfileImage:
 *   post:
 *     summary: Carica l'immagine del profilo utente
 *     description: Carica una nuova immagine profilo su S3 e aggiorna il record utente
 *     tags: [Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - profileImage
 *               - userId
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 5
 *                 description: ID dell'utente
 *               profileImage:
 *                 type: string
 *                 format: binary
 *                 description: File immagine da caricare
 *     responses:
 *       200:
 *         description: Immagine caricata con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Immagine profilo aggiornata con successo"
 *               url: "https://scia-project-questit.s3.amazonaws.com/profile_images/5.jpg"
 *       400:
 *         description: File mancante
 *         content:
 *           application/json:
 *             example:
 *               error: "Nessun file caricato"
 *       404:
 *         description: Utente non trovato
 *         content:
 *           application/json:
 *             example:
 *               error: "User not found"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore nel caricamento dell'immagine"
 */
router.post("/uploadProfileImage", upload.single("profileImage"), profileController.uploadProfileImage);

/**
 * @swagger
 * /api/profile/getRanks:
 *   get:
 *     summary: Recupera tutti i gradi marini
 *     description: Restituisce la lista completa dei gradi disponibili (RanksMarine)
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Lista gradi recuperata con successo
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 name: "Captain"
 *               - id: 2
 *                 name: "Chief Officer"
 *               - id: 3
 *                 name: "Second Officer"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore nel recupero dei dati"
 */
router.get("/getRanks", profileController.getRanks);

/**
 * @swagger
 * /api/profile/getAPIbackend:
 *   get:
 *     summary: Recupera la versione del backend
 *     description: Restituisce la versione corrente del backend dal package.json
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Versione recuperata con successo
 *         content:
 *           application/json:
 *             example:
 *               version: "1.0.0"
 *       401:
 *         description: Errore nel recupero
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid token"
 */
router.get("/getAPIbackend", profileController.getAPIbackend);

/**
 * @swagger
 * /api/profile/getLogs:
 *   get:
 *     summary: Recupera i log del server
 *     description: Restituisce i log applicativi (combined.log o error.log) in ordine cronologico inverso
 *     tags: [Profile]
 *     parameters:
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [error, combined]
 *         example: "error"
 *         description: Tipo di log da recuperare (default combined)
 *     responses:
 *       200:
 *         description: Log recuperati con successo
 *         content:
 *           application/json:
 *             example:
 *               - level: "info"
 *                 message: "Applicazione avviata"
 *                 timestamp: "2024-01-01T00:00:00Z"
 *               - level: "error"
 *                 message: "Errore di connessione"
 *                 timestamp: "2024-01-02T00:00:00Z"
 *       500:
 *         description: Errore nella lettura o parsing dei log
 *         content:
 *           application/json:
 *             example:
 *               message: "Errore durante la lettura dei log."
 */
router.get("/getLogs", profileController.getLogs);

/**
 * @swagger
 * /api/profile/getUsers/{teamId}:
 *   get:
 *     summary: Recupera gli utenti di un team
 *     description: Restituisce tutti i membri del team specificato con ruoli e nave assegnata
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *         description: ID del team
 *     responses:
 *       200:
 *         description: Lista utenti del team recuperata con successo
 *         content:
 *           application/json:
 *             example:
 *               - id: 5
 *                 first_name: "Mario"
 *                 last_name: "Rossi"
 *                 isLeader: true
 *                 team:
 *                   id: 2
 *                   name: "Team Alpha"
 *                 ship:
 *                   id: 1
 *                   unit_name: "Nave Aurora"
 *                 role:
 *                   role_name: "Admin"
 *                   rank: "Captain"
 *       404:
 *         description: Nessun utente trovato per il team
 *         content:
 *           application/json:
 *             example:
 *               error: "No users found for this team"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal server error"
 */
router.get("/getUsers/:teamId", profileController.getUsers);

/**
 * @swagger
 * /api/profile/{userId}/elements:
 *   put:
 *     summary: Aggiorna gli elementi assegnati a un utente
 *     description: Sostituisce la lista degli elementi (Elements) nel ruolo dell'utente specificato
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID dell'utente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - elements
 *             properties:
 *               elements:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3, 5]
 *                 description: Array di ID elementi da assegnare all'utente
 *     responses:
 *       200:
 *         description: Elements aggiornato con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Elements aggiornato con successo."
 *               role:
 *                 user_id: 5
 *                 Elements: "1,2,3,5"
 *       400:
 *         description: Il campo elements non è un array
 *         content:
 *           application/json:
 *             example:
 *               error: "Il campo elements deve essere un array."
 *       404:
 *         description: Ruolo utente non trovato
 *         content:
 *           application/json:
 *             example:
 *               error: "Ruolo utente non trovato."
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore interno del server."
 */
router.put("/:userId/elements", profileController.updateUserElements);

module.exports = router;