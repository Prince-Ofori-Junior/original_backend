const logger = require('../config/logger');

const healthAuth = (req, res, next) => {
  try {
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
  } catch (err) {
    logger.error(`HealthAuth middleware error: ${err.message}`, {
      ip: req.ip,
      path: req.originalUrl,
      stack: err.stack,
    });
    res.status(500).json({
      status: 'error',
      message: 'Internal server error in health check middleware',
    });
  }
};

module.exports = healthAuth;
