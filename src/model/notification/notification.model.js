const pool = require("../../config/db");
const createError = require("http-errors");

// -------------------- CREATE NOTIFICATION --------------------
const createNotification = async ({ targetUserId, title, message, isRead = false, type = "email" }) => {
  if (!targetUserId) throw createError(400, "targetUserId is required");
  if (!title || !message) throw createError(400, "title and message are required");

  const query = `
    INSERT INTO notifications (target_user_id, title, message, is_read, type)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, target_user_id, title, message, is_read, type, created_at, updated_at;
  `;
  const values = [targetUserId, title, message, isRead, type];

  const { rows } = await pool.query(query, values);
  return rows[0];
};

// -------------------- GET USER NOTIFICATIONS --------------------
const getUserNotifications = async (targetUserId) => {
  if (!targetUserId) throw createError(400, "targetUserId is required");

  const query = `
    SELECT id, target_user_id, title, message, is_read, type, created_at, updated_at
    FROM notifications
    WHERE target_user_id = $1
    ORDER BY created_at DESC;
  `;
  const { rows } = await pool.query(query, [targetUserId]);
  return rows;
};

// -------------------- UPDATE NOTIFICATION STATUS --------------------
const updateNotificationStatus = async (notificationId, isRead) => {
  if (!notificationId) throw createError(400, "notificationId is required");
  if (typeof isRead !== "boolean") throw createError(400, "isRead must be a boolean");

  const query = `
    UPDATE notifications
    SET is_read = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, target_user_id, title, message, is_read, type, created_at, updated_at;
  `;
  const { rows } = await pool.query(query, [isRead, notificationId]);
  if (!rows[0]) throw createError(404, "Notification not found");
  return rows[0];
};

// -------------------- LIST ALL NOTIFICATIONS --------------------
const listAllNotifications = async () => {
  const query = `
    SELECT n.id, n.target_user_id, n.title, n.message, n.is_read, n.type, n.created_at, n.updated_at,
           u.name AS user_name, u.email AS user_email
    FROM notifications n
    LEFT JOIN users u ON n.target_user_id = u.id
    ORDER BY n.created_at DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};

module.exports = {
  createNotification,
  getUserNotifications,
  updateNotificationStatus,
  listAllNotifications,
};
