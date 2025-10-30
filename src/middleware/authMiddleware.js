// src/middleware/authMiddleware.js
const { pool } = require("../config/db");
const logger = require("../config/logger");
const jwt = require("jsonwebtoken");
const { logLoginAttempt, isIPBlocked } = require("../utils/loginTracker");

const protect = async (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  let token;

  logger.info(`Incoming request from IP: ${ip}`);

  try {
    // ------------------ IP BLOCK CHECK ------------------
    try {
      const blocked = await isIPBlocked(ip);
      if (blocked) {
        logger.warn(`IP ${ip} is blocked due to too many failed attempts`);
        return res.status(429).json({
          success: false,
          message: "Too many failed login attempts. Try again later.",
        });
      }
    } catch (err) {
      logger.error(`IP block check failed for IP ${ip}: ${err.message}`);
      // fail open: allow request to continue if IP check fails
    }

    // ------------------ GET TOKEN ------------------
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
      logger.info("Authorization header found");
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
    }

    // ------------------ VERIFY TOKEN ------------------
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS512"] });
      logger.info(`JWT decoded for user ID: ${decoded.id}`);
    } catch (err) {
      logger.warn(`JWT verification failed for IP ${ip}: ${err.message}`);
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid or expired token" });
    }

    // ------------------ FETCH USER ------------------
    let user;
    try {
      const { rows } = await pool.query(
        "SELECT id, name, email, role, address, phone, is_active FROM users WHERE id = $1",
        [decoded.id]
      );

      user = rows[0];

      if (!user || !user.is_active) {
        if (user) await logLoginAttempt(user.id, ip, false);
        return res.status(401).json({ success: false, message: "Unauthorized: Invalid user" });
      }

      logger.info(`Fetched user: ${user.email}`);
    } catch (err) {
      logger.error(`Database fetch failed for user ${decoded.id}: ${err.message}`);
      return res.status(500).json({ success: false, message: "Server error fetching user" });
    }

    // ------------------ LOG SUCCESSFUL LOGIN ------------------
    try {
      await logLoginAttempt(user.id, ip, true);
      logger.info(`User ${user.email} authenticated successfully from IP ${ip}`);
    } catch (err) {
      logger.error(`Failed to log successful login for user ${user.id}: ${err.message}`);
    }

    // ------------------ ATTACH USER TO REQUEST ------------------
    req.user = user;
    next();
  } catch (err) {
    logger.error(`Unexpected error in protect middleware [IP: ${ip}]: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server error during authentication" });
  }
};

// ------------------ ROLE-BASED AUTHORIZATION ------------------
const authorize = (allowedRoles = []) => (req, res, next) => {
  try {
    if (!req.user) {
      logger.warn("Authorization attempt without authenticated user");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        `User ${req.user.id} denied access. Allowed roles: ${allowedRoles.join(", ")}`
      );
      return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
    }

    logger.info(`User ${req.user.email} authorized for roles: ${allowedRoles.join(", ")}`);
    next();
  } catch (err) {
    logger.error(`Authorization middleware error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server error during authorization" });
  }
};

module.exports = { protect, authorize };
