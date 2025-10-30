// src/utils/loginAttempts.js
const { pool } = require('../config/db');
const logger = require('../config/logger');

// -------------------- LOG LOGIN ATTEMPT --------------------
const logLoginAttempt = async (userId, ip, success) => {
  try {
    if (!ip) throw new Error("IP address is required to log login attempt");

    await pool.query(
      `INSERT INTO login_attempts(user_id, ip_address, success, created_at)
       VALUES($1, $2, $3, NOW() AT TIME ZONE 'UTC')`,
      [userId || null, ip, success]
    );

    logger.info(
      `Login attempt | user: ${userId || 'unknown'} | ip: ${ip} | success: ${success}`
    );
  } catch (err) {
    // Fail-safe: logging failure should not break authentication flow
    logger.error(`Failed to log login attempt for user ${userId || 'unknown'}: ${err.message}`);
  }
};

// -------------------- CHECK IF IP BLOCKED --------------------
const isIPBlocked = async (ip, maxAttempts = 5, blockInterval = '15 minutes') => {
  try {
    if (!ip) throw new Error("IP address is required to check block status");

    const { rows } = await pool.query(
      `SELECT COUNT(*) AS fail_count
       FROM login_attempts
       WHERE ip_address=$1
         AND success=false
         AND created_at > NOW() AT TIME ZONE 'UTC' - INTERVAL $2`,
      [ip, blockInterval]
    );

    const failedAttempts = parseInt(rows[0].fail_count, 10) || 0;

    if (failedAttempts >= maxAttempts) {
      logger.warn(`IP ${ip} temporarily blocked | Failed attempts: ${failedAttempts}`);
      return true;
    }

    return false;
  } catch (err) {
    logger.error(`Failed to check IP block status for ${ip}: ${err.message}`);
    return false; // fail-safe: don't block legitimate users if DB fails
  }
};

// -------------------- CHECK IF USER BLOCKED --------------------
const isUserBlocked = async (userId, maxAttempts = 5, blockInterval = '15 minutes') => {
  try {
    if (!userId) throw new Error("User ID is required to check block status");

    const { rows } = await pool.query(
      `SELECT COUNT(*) AS fail_count
       FROM login_attempts
       WHERE user_id=$1
         AND success=false
         AND created_at > NOW() AT TIME ZONE 'UTC' - INTERVAL $2`,
      [userId, blockInterval]
    );

    const failedAttempts = parseInt(rows[0].fail_count, 10) || 0;

    if (failedAttempts >= maxAttempts) {
      logger.warn(`User ${userId} temporarily blocked | Failed attempts: ${failedAttempts}`);
      return true;
    }

    return false;
  } catch (err) {
    logger.error(`Failed to check block status for user ${userId}: ${err.message}`);
    return false; // fail-safe
  }
};

module.exports = { logLoginAttempt, isIPBlocked, isUserBlocked };
