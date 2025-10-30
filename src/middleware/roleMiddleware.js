// src/middleware/roleMiddleware.js
const logger = require("../config/logger");

/**
 * Restrict route access based on role(s)
 * Usage: restrictTo('admin') or authorizeRoles('admin', 'manager')
 * Enhanced: logs forbidden attempts, ensures user object is validated
 */
const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.role) {
        logger.warn(`Unauthorized access attempt: No user data - IP: ${req.ip} - URL: ${req.originalUrl}`);
        return res.status(401).json({ success: false, message: "Unauthorized: No user data" });
      }

      // Check if user role is allowed
      if (!allowedRoles.includes(req.user.role)) {
        logger.warn(
          `Forbidden access attempt by user ${req.user.email} (Role: ${req.user.role}) - IP: ${req.ip} - URL: ${req.originalUrl}`
        );

        // Optional: track forbidden access attempts for security monitoring
        // e.g., insert into `security_logs` table for later review

        return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
      }

      next();
    } catch (err) {
      logger.error(`Role Middleware Error: ${err.message} - IP: ${req.ip} - URL: ${req.originalUrl}`);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  };
};

// Alias for semantic clarity
const authorizeRoles = restrictTo;

module.exports = { restrictTo, authorizeRoles };
