const { pool } = require("../../config/db");
const logger = require("../../config/logger");

// -------------------- CREATE USER --------------------
const createUser = async ({
  name,
  email,
  passwordHash,
  role = "user",
  address = null,
  phone = null,
  avatar = null,
  connectedAccounts = {},
}) => {
  const query = `
    INSERT INTO users (name, email, password, role, address, phone, avatar, connected_accounts, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, true, NOW(), NOW())
    RETURNING id, name, email, role, address, phone, avatar, connected_accounts, is_active
  `;
  const values = [name, email, passwordHash, role, address, phone, avatar, JSON.stringify(connectedAccounts)];

  try {
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (err) {
    logger.error(`Failed to create user ${email}: ${err.message}`);
    throw new Error("Failed to create user");
  }
};

// -------------------- FIND USER BY EMAIL --------------------
const findUserByEmail = async (email) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password, role, address, phone, avatar, connected_accounts, is_active 
       FROM users WHERE email=$1 LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  } catch (err) {
    logger.error(`Failed to find user by email ${email}: ${err.message}`);
    throw new Error("Failed to fetch user");
  }
};

// -------------------- FIND USER BY ID --------------------
const findUserById = async (id) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password, role, address, phone, avatar, connected_accounts, is_active 
       FROM users WHERE id=$1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    logger.error(`Failed to find user by id ${id}: ${err.message}`);
    throw new Error("Failed to fetch user");
  }
};

// -------------------- UPDATE PASSWORD --------------------
const updatePassword = async (id, passwordHash) => {
  try {
    await pool.query(
      `UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2`,
      [passwordHash, id]
    );
  } catch (err) {
    logger.error(`Failed to update password for user ${id}: ${err.message}`);
    throw new Error("Failed to update password");
  }
};

// -------------------- UPDATE EMAIL --------------------
const updateEmail = async (id, newEmail) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users SET email=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, email`,
      [newEmail, id]
    );
    return rows[0];
  } catch (err) {
    logger.error(`Failed to update email for user ${id}: ${err.message}`);
    throw new Error("Failed to update email");
  }
};

// -------------------- UPDATE PHONE --------------------
const updatePhone = async (id, newPhone) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users SET phone=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, phone`,
      [newPhone, id]
    );
    return rows[0];
  } catch (err) {
    logger.error(`Failed to update phone for user ${id}: ${err.message}`);
    throw new Error("Failed to update phone");
  }
};

// -------------------- OTP MANAGEMENT --------------------

// Generate OTP and store it in the DB
const createPhoneOTP = async (userId, phone) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

  try {
    await pool.query(
      `INSERT INTO phone_verifications (user_id, phone, otp, expires_at, verified)
       VALUES ($1, $2, $3, $4, false)
       ON CONFLICT (user_id, phone) DO UPDATE
       SET otp=$3, expires_at=$4, verified=false`,
      [userId, phone, otp, expiresAt]
    );
    return otp; // Remove in production; send via SMS
  } catch (err) {
    logger.error(`Failed to create OTP for user ${userId}: ${err.message}`, err);
    throw new Error("Failed to create OTP");
  }
};

// Verify OTP
const verifyPhoneOTP = async (userId, otp) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM phone_verifications WHERE user_id=$1 AND otp=$2 AND verified=false`,
      [userId, otp]
    );

    if (!rows.length) throw new Error("OTP not found or already verified");

    const record = rows[0];
    if (new Date(record.expires_at) < new Date()) throw new Error("OTP expired");

    // Mark OTP as verified
    await pool.query(`UPDATE phone_verifications SET verified=true WHERE id=$1`, [record.id]);

    // Update user's phone
    const { rows: updatedRows } = await pool.query(
      `UPDATE users SET phone=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, phone`,
      [record.phone, userId]
    );

    return updatedRows[0];
  } catch (err) {
    logger.error(`Failed to verify OTP for user ${userId}: ${err.message}`, err);
    throw new Error("Failed to verify OTP");
  }
};

// -------------------- MANAGE CONNECTED ACCOUNTS --------------------
const updateConnectedAccounts = async (id, connectedAccounts) => {
  try {
    if (typeof connectedAccounts !== "object") {
      throw new Error("connectedAccounts must be an object");
    }

    const { rows } = await pool.query(
      `UPDATE users SET connected_accounts=$1::jsonb, updated_at=NOW() WHERE id=$2 RETURNING connected_accounts`,
      [JSON.stringify(connectedAccounts), id]
    );
    return rows[0].connected_accounts;
  } catch (err) {
    logger.error(`Failed to update connected accounts for user ${id}: ${err.message}`, err);
    throw new Error("Failed to update connected accounts");
  }
};

// -------------------- DEACTIVATE USER --------------------
const deactivateUser = async (id) => {
  try {
    await pool.query(
      `UPDATE users SET is_active=false, updated_at=NOW() WHERE id=$1`,
      [id]
    );
  } catch (err) {
    logger.error(`Failed to deactivate user ${id}: ${err.message}`);
    throw new Error("Failed to deactivate user");
  }
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updatePassword,
  updateEmail,
  updatePhone,
  createPhoneOTP,
  verifyPhoneOTP,
  updateConnectedAccounts,
  deactivateUser,
};
 