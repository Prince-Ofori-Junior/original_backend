// src/utils/loginTracker.js
const { pool } = require("../config/db");

/**
 * Log a login attempt for a user
 * @param {string|null} userId - the ID of the user attempting login
 * @param {string} ip - the user's IP address
 * @param {boolean} success - whether the login was successful
 */
const logLoginAttempt = async (userId, ip, success) => {
  try {
    const safeIp = ip || "unknown";

    await pool.query(
      `INSERT INTO login_attempts (user_id, ip_address, success, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [userId, safeIp, success]
    );
  } catch (err) {
    console.error("Error logging login attempt:", err.message);
  }
};

/**
 * Check if an IP is blocked due to too many failed login attempts
 * @param {string} ip - the user's IP address
 * @param {number} maxFailedAttempts - max allowed failed attempts in window
 * @param {number} windowMinutes - timeframe in minutes to check
 * @returns {boolean} true if IP is blocked
 */
const isIPBlocked = async (ip, maxFailedAttempts = 5, windowMinutes = 1500) => {
  try {
    const safeIp = ip || "unknown";

    const result = await pool.query(
      `SELECT COUNT(*) AS failed_count
       FROM login_attempts
       WHERE ip_address = $1
         AND success = false
         AND created_at > NOW() - INTERVAL '${windowMinutes} minutes'`,
      [safeIp]
    );

    return parseInt(result.rows[0].failed_count, 10) >= maxFailedAttempts;
  } catch (err) {
    console.error("Error checking IP block:", err.message);
    return false; // fail-safe: do not block if DB error
  }
};

module.exports = { logLoginAttempt, isIPBlocked };
