const { User, UserSettings } = require("../models");
const mailService = require("../services/mailService");

exports.sendUpcomingNotification = async (userId, type, payload) => {
  const user = await User.findByPk(userId, { include: ["settings"] });
  if (!user || !user.settings) return;

  const s = user.settings;

  if (type === "maintenance" && !s.is_upcoming_maintenance_enabled) return;
  if (type === "checklist" && !s.is_upcoming_checklist_enabled) return;
  if (type === "spare" && !s.is_upcoming_spare_enabled) return;

  let subject = "";
  let html = "";

  switch (type) {
    case "maintenance":
      subject = `Manutenzione eseguibile: ${payload.name}`;
      html = `La manutenzione <b>${payload.name}</b> è ora nello stato verde.<br/>Puoi eseguirla.`;
      break;

    case "checklist":
      subject = `Checklist aggiornata: ${payload.name}`;
      html = `La checklist <b>${payload.name}</b> ha cambiato stato.`;
      break;

    case "spare":
      subject = `Ricambio da ordinare: ${payload.name}`;
      html = `Il ricambio <b>${payload.name}</b> richiede un ordine.`;
      break;
  }

  await mailService.sendMail({
    to: user.settings.email_to_notify || user.email,
    subject,
    html
  });
};
