const catchAsync = require("../../utils/catchAsync");
const apiResponse = require("../../utils/apiResponse");
const logger = require("../../config/logger");
const bcrypt = require("bcrypt");
const crypto = require("crypto"); // for OTP
const { sendSMS } = require('../../config/sms'); // updated sms.js

const {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  revokeRefreshToken,
} = require("./auth.service");
const { verifyRefreshToken, generateToken } = require("../../utils/generateToken");
const { pool } = require("../../config/db");
const smsService = require("../../config/sms"); // your SMS helper

// -------------------- REGISTER --------------------
const register = catchAsync(async (req, res) => {
  const { name, email, password, address, phone } = req.body;
  try {
    const data = await registerUser({ name, email, password, address, phone });
    logger.info(`🆕 User registered: ${email}`);
    return apiResponse(res, 201, true, "User registered successfully", data);
  } catch (err) {
    logger.error(`❌ Registration failed for ${email}: ${err.message}`);
    return apiResponse(res, 400, false, err.message);
  }
});

// -------------------- LOGIN --------------------
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  try {
    const { user, accessToken, refreshToken } = await loginUser({ email, password }, ip);
    logger.info(`🔑 User login successful: ${email}`);
    return apiResponse(res, 200, true, "Login successful", { user, accessToken, refreshToken });
  } catch (err) {
    logger.error(`❌ Login failed for ${email}: ${err.message}`);
    return apiResponse(res, 400, false, err.message);
  }
});

// -------------------- GET LOGGED-IN USER --------------------
const getMeController = catchAsync(async (req, res) => {
  if (!req.user) return apiResponse(res, 401, false, "Not authenticated");

  const { id, name, email, avatar, phone, address, role } = req.user;
  const avatarUrl = avatar
    ? `${process.env.BACKEND_URL || 'http://localhost:8000'}/uploads/avatars/${avatar}`
    : null;

  return apiResponse(res, 200, true, "User info fetched successfully", {
    id, name, email, avatar: avatarUrl, phone, address, role,
  });
});

// -------------------- REFRESH ACCESS TOKEN --------------------
const refreshTokenController = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return apiResponse(res, 400, false, "Refresh token required");

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const { rows } = await pool.query("SELECT * FROM refresh_tokens WHERE token=$1", [refreshToken]);
    if (!rows.length) return apiResponse(res, 401, false, "Invalid refresh token");

    const newAccessToken = generateToken({ id: decoded.id, role: decoded.role });
    const { rows: userRows } = await pool.query(
      "SELECT id, name, email, avatar, phone, address, role FROM users WHERE id=$1", [decoded.id]
    );
    if (!userRows.length) return apiResponse(res, 404, false, "User not found");

    const user = userRows[0];
    const avatarUrl = user.avatar
      ? `${process.env.BACKEND_URL || "http://localhost:8000"}/uploads/avatars/${user.avatar}`
      : null;

    return apiResponse(res, 200, true, "Access token refreshed", {
      accessToken: newAccessToken,
      user: { ...user, avatar: avatarUrl },
    });
  } catch (err) {
    return apiResponse(res, 401, false, err.message);
  }
});

// -------------------- FORGOT PASSWORD --------------------
const forgotPasswordController = catchAsync(async (req, res) => {
  const { email } = req.body;
  try {
    await forgotPassword(email);
    logger.info(`🔐 Password reset requested for: ${email}`);
    return apiResponse(res, 200, true, "If that email exists, instructions have been sent");
  } catch (err) {
    return apiResponse(res, 400, false, err.message);
  }
});

// -------------------- RESET PASSWORD --------------------
const resetPasswordController = catchAsync(async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const success = await resetPassword(token, newPassword);
    if (!success) return apiResponse(res, 400, false, "Invalid or expired token");
    logger.info("✅ Password reset successful");
    return apiResponse(res, 200, true, "Password reset successful");
  } catch (err) {
    return apiResponse(res, 400, false, err.message);
  }
});

// -------------------- LOGOUT --------------------
const logoutController = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  try {
    await revokeRefreshToken(refreshToken);
    logger.info(`👋 User logged out: ${req.user?.email || "unknown"}`);
    return apiResponse(res, 200, true, "Logout successful");
  } catch (err) {
    return apiResponse(res, 500, false, "Failed to logout");
  }
});

// -------------------- GET USER PROFILE --------------------
const getUserProfileController = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return apiResponse(res, 401, false, "Not authenticated");

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, avatar, phone, address, role, bio, premium, premium_plan, premium_expires_at
       FROM users WHERE id=$1`, [userId]
    );
    if (!rows.length) return apiResponse(res, 404, false, "User not found");

    const user = rows[0];
    const avatarUrl = user.avatar
      ? `${process.env.BACKEND_URL || "http://localhost:8000"}/uploads/avatars/${user.avatar}`
      : null;

    return apiResponse(res, 200, true, "User profile fetched successfully", { ...user, avatar: avatarUrl });
  } catch (err) {
    logger.error(`❌ Failed to fetch profile for user ${userId}: ${err.message}`);
    return apiResponse(res, 500, false, "Failed to fetch profile");
  }
});

// -------------------- UPGRADE TO PREMIUM --------------------
const upgradeToPremiumController = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { plan } = req.body;
  try {
    const expiresAt = plan === "yearly"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const { rows } = await pool.query(
      `UPDATE users 
       SET premium = true, premium_plan = $1, premium_expires_at = $2
       WHERE id = $3
       RETURNING id, name, email, premium, premium_plan, premium_expires_at`,
      [plan, expiresAt, userId]
    );

    return apiResponse(res, 200, true, "Premium plan activated", rows[0]);
  } catch (err) {
    logger.error(`❌ Premium upgrade failed for user ${userId}: ${err.message}`);
    return apiResponse(res, 500, false, "Failed to upgrade to premium");
  }
});

// -------------------- UPDATE EMAIL --------------------
const updateEmailController = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const { email } = req.body;
  if (!email) return apiResponse(res, 400, false, "Email is required");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return apiResponse(res, 400, false, "Invalid email format");

  try {
    const { rows } = await pool.query(
      "UPDATE users SET email=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, email",
      [email, userId]
    );
    if (!rows.length) return apiResponse(res, 404, false, "User not found");

    logger.info(`📧 User ${userId} updated email to ${email}`);
    return apiResponse(res, 200, true, "Email updated successfully", rows[0]);
  } catch (err) {
    if (err.code === "23505") return apiResponse(res, 400, false, "Email already in use");
    logger.error(`❌ Failed to update email for user ${userId}: ${err.message}`);
    return apiResponse(res, 500, false, "Failed to update email");
  }
});

// -------------------- UPDATE PASSWORD --------------------
const updatePasswordController = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return apiResponse(res, 400, false, "Current and new password required");

  try {
    const { rows } = await pool.query("SELECT password FROM users WHERE id=$1", [userId]);
    if (!rows.length) return apiResponse(res, 404, false, "User not found");

    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) return apiResponse(res, 400, false, "Current password is incorrect");

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password=$1 WHERE id=$2", [hashedPassword, userId]);
    logger.info(`🔒 User ${userId} updated password`);
    return apiResponse(res, 200, true, "Password updated successfully");
  } catch (err) {
    logger.error(`❌ Failed to update password for user ${userId}: ${err.message}`);
    return apiResponse(res, 500, false, err.message);
  }
});

// -------------------- PHONE UPDATE WITH OTP --------------------

// Helper: normalize phone to E.164
const normalizePhone = (phone) => {
  phone = phone.replace(/[\s-]/g, ''); // remove spaces/dashes
  if (phone.startsWith('0')) phone = '+233' + phone.slice(1);
  if (!phone.startsWith('+')) phone = '+' + phone;
  return phone;
};

// Step 1: Request OTP
const requestPhoneOTPController = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  let { phone } = req.body;

  if (!phone) return apiResponse(res, 400, false, "Phone number is required");

  try {
    // Normalize to E.164 format
    phone = phone.replace(/[\s-]/g, ''); // remove spaces/dashes
    if (phone.startsWith('0')) phone = '+233' + phone.slice(1);
    if (!phone.startsWith('+')) phone = '+' + phone;

    // Validate phone number
    const phoneRegex = /^\+?[1-9]\d{7,14}$/;
    if (!phoneRegex.test(phone)) return apiResponse(res, 400, false, "Invalid phone number format");

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    // Save OTP in DB
    await pool.query(
      `INSERT INTO phone_verifications (user_id, phone, otp, expires_at, verified)
       VALUES ($1, $2, $3, $4, false)`,
      [userId, phone, otp, expiresAt]
    );

    // Send OTP via SMS
    await sendSMS(phone, `Your verification code is: ${otp}`);
    logger.info(`📱 OTP sent to user ${userId} for phone ${phone}`);

    return apiResponse(res, 200, true, "OTP sent to your phone");
  } catch (err) {
    logger.error(`❌ Failed to send OTP to ${phone}:`, err.response?.data || err.message || err);
    return apiResponse(res, 500, false, "Failed to send OTP. Please try again later.");
  }
});



// Step 2: Verify OTP and update phone
const verifyPhoneOTPController = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const { otp } = req.body;

  if (!otp) return apiResponse(res, 400, false, "OTP is required");

  // Fetch OTP from DB
  const { rows } = await pool.query(
    `SELECT * FROM phone_verifications WHERE user_id=$1 AND otp=$2 AND verified=false`,
    [userId, otp]
  );

  if (!rows.length) return apiResponse(res, 400, false, "Invalid or expired OTP");
  if (new Date(rows[0].expires_at) < new Date()) return apiResponse(res, 400, false, "OTP expired");

  const phone = rows[0].phone;

  // Mark OTP as verified
  await pool.query(`UPDATE phone_verifications SET verified=true WHERE id=$1`, [rows[0].id]);

  // Update user phone
  const { rows: updatedRows } = await pool.query(
    `UPDATE users SET phone=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, phone`,
    [phone, userId]
  );

  logger.info(`📱 User ${userId} updated phone to ${phone}`);
  return apiResponse(res, 200, true, "Phone updated successfully", updatedRows[0]);
});

// -------------------- MANAGE CONNECTED ACCOUNTS --------------------
const manageConnectedAccountsController = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const { provider, action } = req.body;

  if (!provider || !action) return apiResponse(res, 400, false, "Provider and action required");

  try {
    const { rows } = await pool.query("SELECT connected_accounts FROM users WHERE id=$1", [userId]);
    if (!rows.length) return apiResponse(res, 404, false, "User not found");

    let accounts = rows[0].connected_accounts || {};
    if (typeof accounts === 'string') accounts = JSON.parse(accounts);

    if (action === "connect") accounts[provider] = true;
    else if (action === "disconnect") delete accounts[provider];
    else return apiResponse(res, 400, false, "Invalid action");

    await pool.query("UPDATE users SET connected_accounts=$1 WHERE id=$2", [JSON.stringify(accounts), userId]);
    logger.info(`🔗 User ${userId} ${action}ed account with ${provider}`);
    return apiResponse(res, 200, true, `Account ${action}ed successfully`, accounts);
  } catch (err) {
    logger.error(`❌ Failed to manage connected accounts for user ${userId}:`, err);
    return apiResponse(res, 500, false, err.message);
  }
});


module.exports = {
  register,
  login,
  getMeController,
  refreshTokenController,
  forgotPasswordController,
  resetPasswordController,
  logoutController,
  getUserProfileController,
  upgradeToPremiumController,
  updateEmailController,
  updatePasswordController,
  requestPhoneOTPController,
  verifyPhoneOTPController,
  manageConnectedAccountsController,
};
