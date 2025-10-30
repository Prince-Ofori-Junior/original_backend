const logger = require('./logger');
const { sendEmail } = require('./mailer'); // the robust SendPulse + SMTP utility
const { Sema } = require('async-sema');

let twilioClient;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    logger.info('✅ Twilio client initialized');
  } catch (err) {
    logger.error(`❌ Failed to initialize Twilio client: ${err.message}`);
  }
}

// -------------------- CONFIGURATION --------------------
const MAX_SMS_PER_SECOND = 1;
const smsLimiter = new Sema(MAX_SMS_PER_SECOND);

// -------------------- HELPERS --------------------
const validatePhoneNumber = (phone) => /^\+?[1-9]\d{1,14}$/.test(phone);

// Map phone numbers to real email addresses for fallback
const phoneToEmail = {
  '+233503635457': 'user@example.com',
  '+1234567890': 'other@example.com',
};

// -------------------- SEND SMS (with full fallback) --------------------
const sendSMS = async (to, message) => {
  if (!message || message.length > 1600) {
    logger.warn('⚠️ SMS content is empty or too long');
    throw new Error('SMS content is empty or too long');
  }

  if (!validatePhoneNumber(to)) {
    logger.warn(`⚠️ Invalid phone number format: ${to}`);
    throw new Error('Invalid phone number');
  }

  // --- 1️⃣ Try Twilio ---
  if (twilioClient) {
    try {
      await smsLimiter.acquire();
      const msg = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to,
      });
      logger.info(`✅ SMS sent via Twilio to ${to}: ${msg.sid}`);
      return { success: true, provider: 'twilio', id: msg.sid };
    } catch (err) {
      logger.warn(`⚠️ Twilio SMS failed to ${to}: ${err.message}`);
      // continue to fallback
    } finally {
      smsLimiter.release();
    }
  } else {
    logger.warn(`⚠️ Twilio not configured, attempting fallback for ${to}`);
  }

  // --- 2️⃣ SendPulse / SMTP fallback ---
  const fallbackEmail = phoneToEmail[to];
  if (!fallbackEmail) {
    logger.error(`❌ No email mapping found for phone ${to}`);
    throw new Error('No available service to send OTP');
  }

  try {
    const emailResult = await sendEmail({
      to: fallbackEmail,
      subject: 'Your OTP Code',
      text: message,
      html: `<p>${message}</p>`,
    });
    logger.info(`✅ OTP sent via email fallback to ${fallbackEmail}`);
    return { success: true, provider: 'email', id: emailResult.id || null };
  } catch (err) {
    logger.error(`❌ Failed to send OTP via email fallback to ${fallbackEmail}: ${err.message}`);
    throw new Error('Failed to send OTP via all available services');
  }
};

module.exports = { sendSMS };
