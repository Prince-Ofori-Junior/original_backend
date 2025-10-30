const createError = require("http-errors");
const {
  sendNotificationService,
  getUserNotificationsService,
  listNotificationsService,
} = require("./notification.service");
const { pool } = require("../../config/db");

// -------------------- SEND NOTIFICATION --------------------
const sendNotification = async (req, res, next) => {
  try {
    const { title, message, targetUserId, type } = req.body;
    if (!title || !message || !targetUserId) {
      throw createError(400, "Title, message, and targetUserId are required");
    }

    // Fetch user email and phone
    const { rows } = await pool.query(
      "SELECT email, phone FROM users WHERE id=$1 AND is_active=true",
      [targetUserId]
    );
    const user = rows[0];
    if (!user) throw createError(404, "User not found or inactive");

    const notification = await sendNotificationService({
      targetUserId,
      type: type || "email",
      title,
      message,
      userEmail: user.email,
      userPhone: user.phone,
    });

    res.status(201).json({ success: true, notification });
  } catch (err) {
    next(err);
  }
};

// -------------------- GET USER NOTIFICATIONS --------------------
const getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw createError(401, "Unauthorized");

    const notifications = await getUserNotificationsService(userId);
    res.json({ success: true, notifications });
  } catch (err) {
    next(err);
  }
};

// -------------------- LIST ALL NOTIFICATIONS (ADMIN) --------------------
const listNotifications = async (req, res, next) => {
  try {
    const notifications = await listNotificationsService();
    res.json({ success: true, notifications });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendNotification,
  getUserNotifications,
  listNotifications,
};
