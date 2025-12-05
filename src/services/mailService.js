const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

exports.sendMail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"SCIA Notifications" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });
    console.log("📧 Mail inviata a:", to);
  } catch (err) {
    console.error("Errore invio email:", err);
  }
};
