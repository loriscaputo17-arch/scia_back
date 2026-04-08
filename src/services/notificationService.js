const { sendEmail } = require("./emailService.js");
const db = require("../config/db");

async function createNotification({ userId, shipId, title, message, type, entityType, entityId }) {
  await db.query(
    `INSERT INTO Notifications (user_id, ship_id, title, message, type, entity_type, entity_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    {
      replacements: [userId, shipId, title, message, type, entityType, entityId],
      type: db.QueryTypes.INSERT
    }
  );
}

async function notifyUserByEmail(userEmail, title, message) {
  await sendEmail(userEmail, title, `<p>${message}</p>`);
}

module.exports = {
  createNotification,
  notifyUserByEmail
};