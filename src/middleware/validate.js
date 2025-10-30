// src/middleware/validateMiddleware.js
const logger = require('../config/logger');

/**
 * validateMiddleware(schema)
 * @param schema - Joi schema or any custom validator function
 * Usage: app.post('/orders', validateMiddleware(orderSchema), orderController.createOrder)
 */
const validateMiddleware = (schema) => {
  return (req, res, next) => {
    try {
      // If schema is a function (custom validation)
      if (typeof schema === 'function') {
        const result = schema(req.body);
        if (result !== true) {
          return res.status(400).json({ success: false, message: result || 'Validation failed' });
        }
      } else if (schema.validate) {
        // If using Joi schema
        const { error } = schema.validate(req.body);
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message });
        }
      } else {
        throw new Error('Invalid validation schema');
      }

      next();
    } catch (err) {
      logger.error('Validation middleware error: ' + err.message);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
};

module.exports = validateMiddleware;
