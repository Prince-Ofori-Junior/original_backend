// src/middleware/redisHealth.js
const redisClient = require('../config/redis');
const logger = require('../config/logger');
const rateLimit = require('express-rate-limit');

// -------------------- Rate Limiter for Health Endpoint --------------------
const healthRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // max 10 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many health check requests, try again later',
  },
});

// -------------------- Redis Health Check Middleware --------------------
const redisHealthCheck = async (req, res) => {
  try {
    // Ping Redis with a 3s timeout
    const ping = await Promise.race([
      redisClient.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timeout')), 3000)
      ),
    ]);

    if (ping === 'PONG') {
      return res.status(200).json({
        status: 'ok',
        services: { redis: 'connected' },
        timestamp: new Date().toISOString(),
      });
    }

    logger.warn('Redis health check returned unexpected response', { ping });
    return res.status(503).json({
      status: 'error',
      services: { redis: 'unhealthy' },
      message: 'Redis ping failed',
    });
  } catch (err) {
    logger.error('Redis health check failed', { stack: err.stack });
    return res.status(503).json({
      status: 'error',
      services: { redis: 'unreachable' },
      message: 'Redis service is unreachable',
    });
  }
};

// -------------------- Combined Export --------------------
// Apply rate limiter + health check
module.exports = [healthRateLimiter, redisHealthCheck];
