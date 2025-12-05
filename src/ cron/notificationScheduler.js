const cron = require("node-cron");
const { User, UserSettings, Maintenance } = require("../models");
const mailService = require("../services/mailService");

cron.schedule("0 7 * * *", async () => { 
  console.log("📆 Invio planning giornaliero");

  const users = await User.findAll({ include: ["settings"] });

  for (const user of users) {
    const s = user.settings;
    if (!s || !s.is_planning_maintenance_enabled) continue;
    if (s.planning_maintenance_frequency !== "daily") continue;

    const upcoming = await Maintenance.findAll({
      where: {  }
    });

    await mailService.sendMail({
      to: user.email,
      subject: "Planning Manutentivo Giornaliero",
      html: generatePlanningHtml(upcoming)
    });
  }
});
