// src/routes/health.js
const express = require('express');
const router = express.Router();
const redisClient = require('../config/redis');
const { pool } = require('../config/db');
const nodemailerTransporter = require('../config/mailer');
const logger = require('../config/logger');

// -------------------- Health Auth Middleware --------------------
const healthAuth = (req, res, next) => {
  const token = req.headers['x-monitoring-token'];
  if (!token || token !== process.env.HEALTH_TOKEN) {
    logger.warn('Unauthorized health check attempt', {
      ip: req.ip,
      path: req.originalUrl,
    });
    return res.status(403).json({
      status: 'forbidden',
      message: 'Unauthorized access to health endpoint',
    });
  }
  next();
};

// -------------------- Combined Health Endpoint --------------------
router.get('/', healthAuth, async (req, res) => {
  const health = {
    redis: 'unknown',
    db: 'unknown',
    email: 'unknown',
    timestamp: new Date().toISOString(),
  };

  // Redis health
  try {
    const ping = await Promise.race([
      redisClient.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis timeout')), 3000)
      ),
    ]);
    health.redis = ping === 'PONG' ? 'ok' : 'unhealthy';
  } catch (err) {
    health.redis = 'unreachable';
    logger.error('Redis health check failed', { stack: err.stack });
  }

  // PostgreSQL health
  try {
    await pool.query('SELECT 1');
    health.db = 'ok';
  } catch (err) {
    health.db = 'unreachable';
    logger.error('DB health check failed', { stack: err.stack });
  }

  // Email health (SMTP)
  try {
    await nodemailerTransporter.verify();
    health.email = 'ok';
  } catch (err) {
    health.email = 'unreachable';
    logger.error('SMTP health check failed', { stack: err.stack });
  }

  // Determine overall status
  const allOk = Object.values(health).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'error',
    services: health,
  });
});

module.exports = router;
