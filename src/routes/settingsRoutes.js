const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: Gestione impostazioni utente
 */

/**
 * @swagger
 * /api/settings/getSettings/{user_id}:
 *   get:
 *     summary: Recupera le impostazioni di un utente
 *     description: Restituisce tutte le impostazioni di notifica, upcoming e planning associate all'utente
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID dell'utente
 *     responses:
 *       200:
 *         description: Impostazioni recuperate con successo
 *         content:
 *           application/json:
 *             example:
 *               user_id: 5
 *               is_notifications_enabled_maintenance: true
 *               maintenance_frequency: 7
 *               is_notifications_enabled_checklist: true
 *               checklist_frequency: 3
 *               license: "premium"
 *               is_upcoming_maintenance_enabled: true
 *               is_upcoming_checklist_enabled: false
 *               is_upcoming_spare_enabled: true
 *               is_planning_maintenance_enabled: true
 *               planning_maintenance_frequency: 30
 *               is_planning_checklist_enabled: false
 *               planning_checklist_frequency: 14
 *               is_planning_spare_enabled: true
 *               planning_spare_frequency: 7
 *               updatedAt: "2024-01-01T00:00:00Z"
 *       400:
 *         description: user_id mancante
 *         content:
 *           application/json:
 *             example:
 *               error: "Missing user_id"
 *       404:
 *         description: Impostazioni non trovate
 *         content:
 *           application/json:
 *             example:
 *               error: "Settings not found"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Error fetching user settings"
 */
router.get("/getSettings/:user_id", settingsController.getSettings);

/**
 * @swagger
 * /api/settings/updateSettings:
 *   post:
 *     summary: Aggiorna le impostazioni di un utente
 *     description: Crea o aggiorna (upsert) le impostazioni dell'utente specificato
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: integer
 *                 example: 5
 *                 description: ID dell'utente
 *               isNotificationsEnabledMaintenance:
 *                 type: boolean
 *                 example: true
 *                 description: Abilita notifiche manutenzione
 *               maintenanceFrequency:
 *                 type: integer
 *                 example: 7
 *                 description: Frequenza notifiche manutenzione (giorni)
 *               isNotificationsEnabledChecklist:
 *                 type: boolean
 *                 example: true
 *                 description: Abilita notifiche checklist
 *               checklistFrequency:
 *                 type: integer
 *                 example: 3
 *                 description: Frequenza notifiche checklist (giorni)
 *               license:
 *                 type: string
 *                 example: "premium"
 *                 description: Tipo di licenza utente
 *               isUpcomingMaintenanceEnabled:
 *                 type: boolean
 *                 example: true
 *                 description: Abilita avvisi manutenzioni in scadenza
 *               isUpcomingChecklistEnabled:
 *                 type: boolean
 *                 example: false
 *                 description: Abilita avvisi checklist in scadenza
 *               isUpcomingSpareEnabled:
 *                 type: boolean
 *                 example: true
 *                 description: Abilita avvisi ricambi in scadenza
 *               isPlanningMaintenanceEnabled:
 *                 type: boolean
 *                 example: true
 *                 description: Abilita planning manutenzione
 *               planningMaintenanceFrequency:
 *                 type: integer
 *                 example: 30
 *                 description: Frequenza planning manutenzione (giorni)
 *               isPlanningChecklistEnabled:
 *                 type: boolean
 *                 example: false
 *                 description: Abilita planning checklist
 *               planningChecklistFrequency:
 *                 type: integer
 *                 example: 14
 *                 description: Frequenza planning checklist (giorni)
 *               isPlanningSpareEnabled:
 *                 type: boolean
 *                 example: true
 *                 description: Abilita planning ricambi
 *               planningSpareFrequency:
 *                 type: integer
 *                 example: 7
 *                 description: Frequenza planning ricambi (giorni)
 *     responses:
 *       200:
 *         description: Impostazioni aggiornate con successo
 *         content:
 *           application/json:
 *             example:
 *               message: "Settings updated successfully"
 *       400:
 *         description: user_id mancante
 *         content:
 *           application/json:
 *             example:
 *               error: "Missing user_id"
 *       500:
 *         description: Errore server
 *         content:
 *           application/json:
 *             example:
 *               error: "Error updating user settings"
 */
router.post("/updateSettings", settingsController.updateSettings);

module.exports = router;