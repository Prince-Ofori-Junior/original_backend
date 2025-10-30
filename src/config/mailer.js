// src/onfig/email.js
const nodemailer = require("nodemailer");
const axios = require("axios");
const logger = require("./logger");

let sendPulseToken = null;
let tokenExpiry = 0;

// -------------------- ENV VALIDATION --------------------
const requiredVars = ["SENDPULSE_CLIENT_ID", "SENDPULSE_CLIENT_SECRET"];
for (const v of requiredVars) {
  if (!process.env[v]) {
    logger.error(`❌ Missing required environment variable: ${v}`);
    process.exit(1);
  }
}

// Optional SMTP fallback
let smtpTransporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  try {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    });

    smtpTransporter.verify((err) => {
      if (err) logger.error(`❌ SMTP verification failed: ${err.message}`);
      else logger.info("✅ SMTP ready to send emails");
    });
  } catch (err) {
    logger.error(`❌ SMTP setup error: ${err.message}`);
    smtpTransporter = null; // fallback disabled
  }
}

// -------------------- SENDPULSE TOKEN --------------------
const getSendPulseToken = async () => {
  const now = Date.now();
  if (sendPulseToken && now < tokenExpiry) return sendPulseToken;

  try {
    const res = await axios.post("https://api.sendpulse.com/oauth/access_token", {
      grant_type: "client_credentials",
      client_id: process.env.SENDPULSE_CLIENT_ID,
      client_secret: process.env.SENDPULSE_CLIENT_SECRET,
    });

    sendPulseToken = res.data.access_token;
    tokenExpiry = now + res.data.expires_in * 1000 - 5000; // 5s buffer
    logger.info("✅ SendPulse token retrieved");
    return sendPulseToken;
  } catch (err) {
    logger.error(`❌ Failed to get SendPulse token: ${err.message}`);
    throw new Error("SendPulse token retrieval failed");
  }
};

// -------------------- SEND EMAIL --------------------
/**
 * options: { to, subject, text, html, fromName, fromEmail }
 */
const sendEmail = async ({ to, subject, text, html, fromName = "No Reply", fromEmail }) => {
  if (!to || (!text && !html)) throw new Error("Email 'to' and content required");

  fromEmail = fromEmail || process.env.SMTP_FROM || process.env.SMTP_USER;

  // 1️⃣ Try SendPulse first
  try {
    const token = await getSendPulseToken();
    const payload = {
      email: {
        html: html || text,
        text: text || html,
        subject,
        from: { name: fromName, email: fromEmail },
        to: [{ email: to }],
      },
    };

    const res = await axios.post("https://api.sendpulse.com/smtp/emails", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    logger.info(`📧 SendPulse email sent to ${to}`);
    return res.data;
  } catch (err) {
    logger.warn(`⚠️ SendPulse failed, falling back to SMTP: ${err.message}`);
  }

  // 2️⃣ Fallback to SMTP if configured
  if (smtpTransporter) {
    try {
      const info = await smtpTransporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text,
        html,
      });

      logger.info(`📧 SMTP email sent to ${to}: ${info.messageId}`);
      return info;
    } catch (err) {
      logger.error(`❌ Failed to send email via SMTP: ${err.message}`);
      throw new Error("SMTP email sending failed");
    }
  }

  throw new Error("No available email service to send the message");
};

module.exports = { sendEmail };
