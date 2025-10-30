const logger = require("../config/logger");

/**
 * 404 Not Found Middleware
 */
const notFound = (req, res, next) => {
  try {
    logger.warn(`404 Not Found - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    res.status(404).json({
      success: false,
      message: "Resource not found",
    });
  } catch (err) {
    logger.error(`Error in notFound middleware: ${err.message}`);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/**
 * Centralized Error Handler
 */
const errorHandler = (err, req, res, next) => {
  try {
    // Ensure the message is a string
    const message = typeof err.message === "string"
      ? err.message
      : JSON.stringify(err.message || err);

    const statusCode = err.status || 500;

    // Log detailed error
    logger.error({
      message,
      method: req.method,
      url: req.originalUrl,
      stack: err.stack,
      ip: req.ip,
      user: req.user ? req.user.id : null,
    });

    // Send sanitized response to client
    res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Internal Server Error" : message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    });
  } catch (handlerErr) {
    // Fail-safe if error occurs inside errorHandler
    logger.error(`Error in errorHandler middleware: ${handlerErr.message}`);
    res.status(500).json({
      success: false,
      message: "Critical server error",
    });
  }
};

/**
 * Async wrapper for async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { notFound, errorHandler, asyncHandler };
