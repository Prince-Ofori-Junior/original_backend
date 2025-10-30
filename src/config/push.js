const admin = require('firebase-admin');
const logger = require('./logger');
const { pool } = require('./db');
const path = require('path');
const fs = require('fs');

let firebaseInitialized = false;

// -------------------- INITIALIZE FIREBASE --------------------
const initializeFirebase = () => {
  if (firebaseInitialized) return;

  try {
    // --- Option 1: JSON service account (preferred) ---
    const serviceAccountPath = path.join(__dirname, '../secrets/firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      firebaseInitialized = true;
      logger.info('✅ Firebase Admin initialized using JSON service account');
      return;
    }

    // --- Option 2: Fallback to .env ---
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      throw new Error(
        'Firebase env variables missing. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    firebaseInitialized = true;
    logger.info('✅ Firebase Admin initialized using .env credentials');

  } catch (err) {
    logger.error(`❌ Firebase initialization failed: ${err.message}`);
    throw new Error('Firebase initialization failed');
  }
};

// Initialize immediately
initializeFirebase();

// -------------------- HELPER: GET USER DEVICE TOKENS --------------------
const getUserDeviceTokens = async (userId) => {
  try {
    const { rows } = await pool.query(
      'SELECT device_token FROM user_devices WHERE user_id = $1 AND active = true',
      [userId]
    );
    return rows.map((r) => r.device_token);
  } catch (err) {
    logger.error(`❌ Failed to fetch device tokens for user ${userId}: ${err.message}`);
    return []; // fail-safe
  }
};

// -------------------- SEND PUSH TO SINGLE USER --------------------
const sendPush = async (userId, title, body, data = {}) => {
  try {
    const tokens = await getUserDeviceTokens(userId);
    if (!tokens.length) {
      logger.warn(`⚠️ Push skipped: No active device tokens for user ${userId}`);
      return null;
    }

    const response = await admin.messaging().sendMulticast({
      notification: { title, body },
      data,
      tokens,
    });

    logger.info(
      `📩 Push sent to user ${userId}. Success: ${response.successCount}, Failures: ${response.failureCount}`
    );
    return response;
  } catch (err) {
    logger.error(`❌ Push notification failed for user ${userId}: ${err.message}`);
    throw new Error('Push notification failed');
  }
};

// -------------------- BROADCAST PUSH --------------------
const sendBroadcastPush = async (title, body, data = {}) => {
  try {
    const { rows } = await pool.query('SELECT device_token FROM user_devices WHERE active = true');
    const tokens = rows.map((r) => r.device_token);
    if (!tokens.length) {
      logger.warn('⚠️ Broadcast push skipped: No active tokens');
      return null;
    }

    const response = await admin.messaging().sendMulticast({
      notification: { title, body },
      data,
      tokens,
    });

    logger.info(`📡 Broadcast push sent. Success: ${response.successCount}, Failures: ${response.failureCount}`);
    return response;
  } catch (err) {
    logger.error(`❌ Broadcast push failed: ${err.message}`);
    throw new Error('Broadcast push failed');
  }
};

module.exports = { sendPush, sendBroadcastPush };
