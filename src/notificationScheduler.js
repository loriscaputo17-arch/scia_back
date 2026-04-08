const cron = require("node-cron");
const { createNotification } = require("./services/notificationService");
const { JobExecution } = require("./models");

cron.schedule("0 8 * * *", async () => {
  console.log("🔔 Controllo manutenzioni in scadenza...");

  const today = new Date();
  const soon = new Date();
  soon.setDate(today.getDate() + 2);

  const jobs = await JobExecution.findAll({
    where: {
      ending_date: {
        [require("sequelize").Op.lte]: soon
      }
    }
  });

  for (const job of jobs) {
    await createNotification({
      userId: job.user_id,
      shipId: job.ship_id,
      title: "Manutenzione in scadenza",
      message: `La manutenzione ${job.id} scade tra poco`,
      type: "maintenance_due",
      entityType: "maintenance",
      entityId: job.id
    });
  }

});