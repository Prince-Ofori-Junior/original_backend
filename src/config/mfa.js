const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const logger = require('../config/logger');
const { pool } = require('../config/db');

authenticator.options = {
  step: 30,          // 30 seconds per token
  window: 1,         // allow 1 step before/after
  crypto: require('crypto'),
  algorithm: 'sha512', // stronger than default sha1
};

// -------------------- MFA SECRET --------------------
const generateMFASecret = async (userId, email) => {
  try {
    if (!userId || !email) throw new Error('User ID and email are required for MFA');

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, 'JumiaClone', secret);

    await pool.query(
      'UPDATE users SET mfa_secret=$1, mfa_enabled=false WHERE id=$2',
      [secret, userId]
    );

    logger.info(`✅ MFA secret generated for user ${userId}`);
    return { secret, otpauth };
  } catch (err) {
    logger.error(`❌ Failed to generate MFA secret for user ${userId}: ${err.message}`);
    throw new Error('Could not initialize MFA');
  }
};

// -------------------- VERIFY MFA --------------------
const verifyMFA = async (userId, token) => {
  try {
    if (!userId || !token) throw new Error('User ID and MFA token are required');

    const { rows } = await pool.query('SELECT mfa_secret FROM users WHERE id=$1', [userId]);
    if (!rows.length) throw new Error('User not found');

    const secret = rows[0].mfa_secret;
    const isValid = authenticator.check(token, secret);

    if (!isValid) {
      logger.warn(`⚠️ Failed MFA attempt for user ${userId}`);
    } else {
      logger.info(`✅ MFA verified for user ${userId}`);
    }

    return isValid;
  } catch (err) {
    logger.error(`❌ MFA verification error for user ${userId}: ${err.message}`);
    throw err;
  }
};

// -------------------- GENERATE QR CODE --------------------
const generateQRCode = async (otpauth) => {
  try {
    if (!otpauth) throw new Error('OTPAuth URI is required to generate QR code');
    const qrDataURL = await qrcode.toDataURL(otpauth, { errorCorrectionLevel: 'H' });
    logger.info(`✅ MFA QR code generated`);
    return qrDataURL;
  } catch (err) {
    logger.error(`❌ Failed to generate MFA QR code: ${err.message}`);
    throw new Error('Could not generate MFA QR code');
  }
};

module.exports = { generateMFASecret, verifyMFA, generateQRCode };
