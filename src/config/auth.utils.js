const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/db');
const logger = require('../config/logger');
const { encrypt, decrypt } = require('../utils/crypto'); // optional encryption helper

// ------------------ ACCESS TOKEN ------------------
const generateAccessToken = (user) => {
  try {
    const payload = { id: user.id, role_id: user.role_id };
    return jwt.sign(payload, process.env.JWT_PRIVATE_KEY, {
      algorithm: 'RS256', // secure
      expiresIn: '15m',
    });
  } catch (err) {
    logger.error(`❌ Error generating access token for user ${user.id}: ${err.message}`, {
      stack: err.stack,
    });
    throw new Error('ACCESS_TOKEN_GENERATION_FAILED');
  }
};

// ------------------ REFRESH TOKEN ------------------
const generateRefreshToken = async (user) => {
  try {
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const encryptedToken = encrypt ? encrypt(refreshToken) : refreshToken;

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, created_at) VALUES ($1, $2, NOW())`,
      [user.id, encryptedToken]
    );

    logger.info(`🔑 Refresh token generated for user ${user.id}`);
    return refreshToken;
  } catch (err) {
    logger.error(`❌ Error generating refresh token for user ${user.id}: ${err.message}`, {
      stack: err.stack,
    });
    throw new Error('REFRESH_TOKEN_GENERATION_FAILED');
  }
};

// ------------------ VALIDATE REFRESH TOKEN ------------------
const isRefreshTokenValid = async (token) => {
  try {
    const encryptedToken = encrypt ? encrypt(token) : token;
    const result = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token=$1',
      [encryptedToken]
    );
    return result.rows.length > 0;
  } catch (err) {
    logger.error(`❌ Error validating refresh token: ${err.message}`, { stack: err.stack });
    throw new Error('REFRESH_TOKEN_VALIDATION_FAILED');
  }
};

// ------------------ REVOKE TOKEN ------------------
const revokeRefreshToken = async (token) => {
  try {
    const encryptedToken = encrypt ? encrypt(token) : token;
    const result = await pool.query(
      'DELETE FROM refresh_tokens WHERE token=$1 RETURNING *',
      [encryptedToken]
    );

    if (result.rowCount > 0) {
      logger.info(`🗑 Refresh token revoked`);
      return true;
    }
    return false;
  } catch (err) {
    logger.error(`❌ Error revoking refresh token: ${err.message}`, { stack: err.stack });
    throw new Error('REFRESH_TOKEN_REVOKE_FAILED');
  }
};

// ------------------ ROTATE TOKEN ------------------
const rotateRefreshToken = async (oldToken, user) => {
  try {
    await revokeRefreshToken(oldToken);
    return await generateRefreshToken(user);
  } catch (err) {
    logger.error(`❌ Error rotating refresh token for user ${user.id}: ${err.message}`, {
      stack: err.stack,
    });
    throw new Error('REFRESH_TOKEN_ROTATION_FAILED');
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  revokeRefreshToken,
  isRefreshTokenValid,
  rotateRefreshToken,
};
