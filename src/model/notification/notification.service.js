const { pool } = require("../../config/db");
const logger = require("../../config/logger");
const {
  createNotification,
  getUserNotifications,
  listAllNotifications,
  updateNotificationStatus,
} = require("./notification.model");

// -------------------- SEND NOTIFICATION SERVICE --------------------
const sendNotificationService = async (payload = {}) => {
  try {
    const {
      user_id,
      targetUserId,
      targeted_user,
      title,
      message,
      type = "email",
      userEmail,
      userPhone,
    } = payload;

    const userId = user_id || targetUserId || targeted_user;

    logger.info(
      `🔔 sendNotificationService called with: ${JSON.stringify({
        userId,
        title,
        message,
        type,
      })}`
    );

    if (!userId) {
      logger.warn("⚠️ Skipping notification: no userId provided.");
      return null;
    }

    if (!title || !message) {
      logger.warn(
        `⚠️ Notification missing title/message. Payload: ${JSON.stringify(payload)}`
      );
      return null;
    }

    const notification = await createNotification({
      targetUserId: userId,
      title,
      message,
      type,
    });

    if (type === "email" && userEmail) {
      logger.info(`📧 Email notification to ${userEmail}: ${title}`);
      // TODO: sendEmail(userEmail, title, message);
    } else if (type === "sms" && userPhone) {
      logger.info(`📱 SMS notification to ${userPhone}: ${message}`);
      // TODO: sendSMS(userPhone, message);
    }

    logger.info(`✅ Notification recorded for user ${userId}`);
    return notification;
  } catch (err) {
    logger.error(`❌ Notification service error: ${err.message}`);
    return null;
  }
};

// -------------------- GET USER NOTIFICATIONS --------------------
const getUserNotificationsService = async (userId) => {
  return await getUserNotifications(userId);
};

// -------------------- LIST ALL NOTIFICATIONS --------------------
const listNotificationsService = async () => {
  return await listAllNotifications();
};

// -------------------- UPDATE NOTIFICATION STATUS --------------------
const markNotificationAsReadService = async (notificationId) => {
  return await updateNotificationStatus(notificationId, true);
};

module.exports = {
  sendNotificationService,
  getUserNotificationsService,
  listNotificationsService,
  markNotificationAsReadService,
};
