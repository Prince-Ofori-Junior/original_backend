// src/middleware/rateLimiter.js
const rateLimit = require("express-rate-limit").default; // ✅ v6+ compatible

/**
 * Creates a configurable rate limiter middleware
 * @param {object} options - options for express-rate-limit
 * @returns {function} Express middleware
 */
const createRateLimiter = (options = {}) => {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes default
    max: 100, // 100 requests per IP default
    message: {
      success: false,
      message: "Too many requests from this IP. Please try again later.",
    },
    standardHeaders: true,  // Sends RateLimit info in `RateLimit-*` headers
    legacyHeaders: false,   // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests: false,
    ...options, // Override defaults per route
  });

  // Wrap in try/catch to prevent unexpected crashes
  return (req, res, next) => {
    try {
      return limiter(req, res, next);
    } catch (err) {
      console.error(`RateLimiter error: ${err.message}`);
      return res.status(500).json({
        success: false,
        message: "Internal server error in rate limiter",
      });
    }
  };
};

module.exports = createRateLimiter;
