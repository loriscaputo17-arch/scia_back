const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticazione e sicurezza utente
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login con email e password
 *     description: Autentica l'utente con email e password, restituisce un JWT valido 8 ore con permessi nave inclusi
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: "mario.rossi@example.com"
 *                 description: Email dell'utente
 *               password:
 *                 type: string
 *                 example: "password123"
 *                 description: Password in chiaro
 *     responses:
 *       200:
 *         description: Login effettuato con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Login successful"
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Credenziali non valide
 *         content:
 *           application/json:
 *             example:
 *               error: "Credentials are not valid."
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Error during login"
 */
router.post("/login", authController.loginWithEmail);

/**
 * @swagger
 * /api/auth/login-pin:
 *   post:
 *     summary: Login rapido con PIN
 *     description: Autentica l'utente tramite PIN a 4 cifre (pin_enabled deve essere true), restituisce un JWT valido 8 ore
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pin
 *             properties:
 *               pin:
 *                 type: string
 *                 example: "1234"
 *                 description: PIN a 4 cifre
 *     responses:
 *       200:
 *         description: Login PIN effettuato con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Login PIN effettuato"
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: PIN non valido o disabilitato
 *         content:
 *           application/json:
 *             example:
 *               error: "PIN non valido o disabilitato."
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Errore durante il login rapido"
 */
router.post("/login-pin", authController.loginWithPin);

/**
 * @swagger
 * /api/auth/set-pin:
 *   post:
 *     summary: Imposta il PIN utente
 *     description: Aggiorna il PIN associato all'email specificata. Il PIN deve essere esattamente 4 cifre numeriche.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - pin
 *             properties:
 *               email:
 *                 type: string
 *                 example: "mario.rossi@example.com"
 *                 description: Email dell'utente
 *               pin:
 *                 type: string
 *                 example: "1234"
 *                 description: PIN a 4 cifre numeriche
 *     responses:
 *       200:
 *         description: PIN aggiornato con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "PIN updated successfully."
 *       400:
 *         description: PIN non valido (non sono 4 cifre)
 *         content:
 *           application/json:
 *             example:
 *               error: "The PIN must consist of 4 digits."
 *       404:
 *         description: Utente non trovato
 *         content:
 *           application/json:
 *             example:
 *               error: "User not found."
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Error updating PIN"
 */
router.post("/set-pin", authController.setPin);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout utente
 *     description: Cancella il cookie "token" e invalida la sessione
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout effettuato con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Logout successful"
 */
router.post("/logout", authController.logout);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Richiesta reset password
 *     description: Invia un link di reset password all'email specificata
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: "mario.rossi@example.com"
 *                 description: Email dell'utente
 *     responses:
 *       200:
 *         description: Link di reset inviato con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Reset link sent to your email"
 *       404:
 *         description: Email non trovata
 *         content:
 *           application/json:
 *             example:
 *               error: "Email not found"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Server error"
 */
router.post("/forgot-password", authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password tramite token
 *     description: Aggiorna la password dell'utente tramite il token JWT ricevuto via email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 description: Token JWT ricevuto via email
 *               newPassword:
 *                 type: string
 *                 example: "nuovaPassword123"
 *                 description: Nuova password in chiaro
 *     responses:
 *       200:
 *         description: Password aggiornata con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Password reset successfully"
 *       400:
 *         description: Token non valido o scaduto
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid or expired token"
 *       404:
 *         description: Utente non trovato
 *         content:
 *           application/json:
 *             example:
 *               error: "User not found"
 *       500:
 *         description: Errore server
 */
router.post("/reset-password", authController.resetPassword);

/**
 * @swagger
 * /api/auth/getSecuritySettings:
 *   post:
 *     summary: Recupera le impostazioni di sicurezza utente
 *     description: >
 *       Restituisce biometric_enabled e pin_enabled dell'utente.
 *       userId può essere passato nel body, nella query o letto dal token JWT (req.user)
 *     tags: [Auth]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 5
 *                 description: ID utente (alternativo a query param o JWT)
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: false
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID utente (alternativo a body o JWT)
 *     responses:
 *       200:
 *         description: Impostazioni di sicurezza recuperate con successo
 *         content:
 *           application/json:
 *             example:
 *               biometric_enabled: true
 *               pin_enabled: false
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
 *               error: "User not found."
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Error retrieving security settings"
 */
router.post("/getSecuritySettings", authController.getUserSecuritySettings);

/**
 * @swagger
 * /api/auth/updateSecuritySettings:
 *   post:
 *     summary: Aggiorna le impostazioni di sicurezza utente
 *     description: >
 *       Aggiorna biometric_enabled, pin_enabled e PIN. Se newPassword è presente,
 *       verifica oldPassword prima di aggiornare la password hashata.
 *       Se viene passato pin, deve essere esattamente 4 cifre e pin_enabled viene forzato a true.
 *     tags: [Auth]
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
 *                 description: ID utente
 *               useBiometric:
 *                 type: boolean
 *                 example: true
 *                 description: Abilita/disabilita autenticazione biometrica
 *               useQuickPin:
 *                 type: boolean
 *                 example: false
 *                 description: Abilita/disabilita login rapido con PIN
 *               pin:
 *                 type: string
 *                 example: "4321"
 *                 description: Nuovo PIN a 4 cifre (opzionale, forza pin_enabled a true)
 *               oldPassword:
 *                 type: string
 *                 example: "vecchiaPassword123"
 *                 description: Password attuale (obbligatoria solo se si vuole cambiare password)
 *               newPassword:
 *                 type: string
 *                 example: "nuovaPassword456"
 *                 description: Nuova password (opzionale)
 *     responses:
 *       200:
 *         description: Impostazioni di sicurezza aggiornate con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Security settings updated successfully."
 *       400:
 *         description: Password vecchia errata o PIN non valido
 *         content:
 *           application/json:
 *             example:
 *               error: "Old password incorrect."
 *       404:
 *         description: Utente non trovato
 *         content:
 *           application/json:
 *             example:
 *               error: "User not found."
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Error updating security settings"
 */
router.post("/updateSecuritySettings", authController.updateUserSecuritySettings);

module.exports = router;