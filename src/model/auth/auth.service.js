const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { pool } = require("../../config/db");
const logger = require("../../config/logger");
const transporter = require("../../config/mailer");
const {
  createUser,
  findUserByEmail,
  findUserById,
  updatePassword,
  deactivateUser,
} = require("./auth.model");
const { logLoginAttempt, isIPBlocked } = require("../../utils/loginTracker");

// -------------------- JWT --------------------
const generateToken = (user, expiresIn = "7d") =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn,
    algorithm: "HS512",
  });

const generateRefreshToken = async (user, expiresIn = "7d") => {
  const refreshToken = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn, algorithm: "HS512" }
  );

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [user.id, refreshToken]
  );

  return refreshToken;
};

// -------------------- REGISTER --------------------
const registerUser = async ({ name, email, password, address, phone }) => {
  const existingUser = await findUserByEmail(email);
  if (existingUser) throw new Error("User already exists");

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  const user = await createUser({ name, email, passwordHash, address, phone });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      address: user.address,
      phone: user.phone,
      role: user.role,
    },
    accessToken: generateToken(user),
    refreshToken: await generateRefreshToken(user),
  };
};

// -------------------- LOGIN --------------------
const loginUser = async ({ email, password }, ip) => {
  if (await isIPBlocked(ip)) throw new Error("Too many failed attempts. Try again later.");

  const user = await findUserByEmail(email);
  if (!user || !user.is_active) throw new Error("Invalid credentials");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    await logLoginAttempt(user.id, ip, false);
    throw new Error("Invalid credentials");
  }

  await logLoginAttempt(user.id, ip, true);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      address: user.address,
      phone: user.phone,
      role: user.role,
    },
    accessToken: generateToken(user),
    refreshToken: await generateRefreshToken(user),
  };
};

// -------------------- REFRESH ACCESS TOKEN --------------------
const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, { algorithms: ["HS512"] });

    const { rows } = await pool.query(
      "SELECT * FROM refresh_tokens WHERE token=$1 AND user_id=$2",
      [refreshToken, decoded.id]
    );
    if (!rows.length) throw new Error("Invalid refresh token");

    const user = await findUserById(decoded.id);
    if (!user || !user.is_active) throw new Error("User not found");

    const accessToken = generateToken(user);
    const avatarUrl = user.avatar
      ? `${process.env.BACKEND_URL || "http://localhost:8000"}/uploads/avatars/${user.avatar}`
      : null;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        address: user.address,
        phone: user.phone,
        avatar: avatarUrl,
      },
      accessToken,
    };
  } catch (err) {
    throw new Error("Invalid or expired refresh token");
  }
};

// -------------------- PASSWORD RESET --------------------
const forgotPassword = async (email) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("No account found with this email");

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  await pool.query(
    `UPDATE users SET reset_token=$1, reset_expires=NOW() + INTERVAL '1 hour' WHERE id=$2`,
    [hashedToken, user.id]
  );

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  await transporter.sendMail({
    to: user.email,
    subject: "Password Reset Request",
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`,
  });

  return resetToken;
};

const resetPassword = async (token, newPassword) => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const { rows } = await pool.query(
    `SELECT id, reset_expires FROM users WHERE reset_token=$1`,
    [hashedToken]
  );

  if (!rows.length || new Date(rows[0].reset_expires) < new Date()) return false;

  const userId = rows[0].id;
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  await updatePassword(userId, passwordHash);
  await pool.query(`UPDATE users SET reset_token=NULL, reset_expires=NULL WHERE id=$1`, [userId]);
  return true;
};

// -------------------- REVOKE REFRESH TOKEN --------------------
const revokeRefreshToken = async (refreshToken) => {
  await pool.query(`DELETE FROM refresh_tokens WHERE token=$1`, [refreshToken]);
  return true;
};

// -------------------- PROFILE MANAGEMENT --------------------
const updateEmail = async (userId, newEmail) => {
  const existingUser = await findUserByEmail(newEmail);
  if (existingUser) throw new Error("Email already in use");

  const { rows } = await pool.query(
    "UPDATE users SET email=$1 WHERE id=$2 RETURNING id, name, email",
    [newEmail, userId]
  );
  return rows[0];
};

const updatePhone = async (userId, newPhone) => {
  const { rows } = await pool.query(
    "UPDATE users SET phone=$1 WHERE id=$2 RETURNING id, name, phone",
    [newPhone, userId]
  );
  return rows[0];
};

const updateUserPassword = async (userId, currentPassword, newPassword) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw new Error("Current password is incorrect");

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);
  await updatePassword(userId, passwordHash);
  return true;
};

const manageConnectedAccounts = async (userId, provider, action) => {
  const { rows } = await pool.query(
    "SELECT connected_accounts FROM users WHERE id=$1",
    [userId]
  );
  if (!rows.length) throw new Error("User not found");

  let accounts = rows[0].connected_accounts || {};
  if (typeof accounts === "string") accounts = JSON.parse(accounts);

  if (action === "connect") accounts[provider] = true;
  else if (action === "disconnect") delete accounts[provider];
  else throw new Error("Invalid action");

  await pool.query(
    "UPDATE users SET connected_accounts=$1 WHERE id=$2",
    [JSON.stringify(accounts), userId]
  );
  return accounts;
};

// -------------------- PHONE OTP --------------------
const requestPhoneOTP = async (userId, newPhone) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  await pool.query(
    `INSERT INTO phone_otps (user_id, phone, otp_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, phone) DO UPDATE
     SET otp_hash = $3, expires_at = $4`,
    [userId, newPhone, hashedOTP, expiresAt]
  );

  logger.info(`OTP for phone ${newPhone} of user ${userId}: ${otp}`);
  return otp; // Remove in production
};



const verifyPhoneOTP = async (userId, newPhone, otp) => {
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

  const { rows } = await pool.query(
    `SELECT otp_hash, expires_at FROM phone_otps WHERE user_id=$1 AND phone=$2`,
    [userId, newPhone]
  );

  if (!rows.length) throw new Error("OTP not requested for this phone");
  const record = rows[0];

  if (new Date(record.expires_at) < new Date()) throw new Error("OTP expired");
  if (record.otp_hash !== hashedOTP) throw new Error("Invalid OTP");

  const { rows: updatedRows } = await pool.query(
    "UPDATE users SET phone=$1 WHERE id=$2 RETURNING id, name, phone",
    [newPhone, userId]
  );

  await pool.query("DELETE FROM phone_otps WHERE user_id=$1 AND phone=$2", [userId, newPhone]);
  return updatedRows[0];
};

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  revokeRefreshToken,
  generateToken,
  generateRefreshToken,
  // Profile management
  updateEmail,
  updatePhone,
  updateUserPassword,
  manageConnectedAccounts,
  // Phone OTP
  requestPhoneOTP,
  verifyPhoneOTP,
};
  