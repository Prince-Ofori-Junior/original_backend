// utils/validation.js
const { body, query, param, validationResult, sanitizeBody } = require('express-validator');

/**
 * Centralized validation handler
 * Returns 400 with sanitized error messages if validation fails
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Only return relevant fields to avoid leaking internal info
    const sanitizedErrors = errors.array().map(err => ({
      field: err.param,
      message: err.msg,
    }));
    return res.status(400).json({ success: false, errors: sanitizedErrors });
  }
  next();
};

// ------------------ Promotion Validation ------------------

// Admin: Validate promotion creation/update payload
const validatePromotionInput = [
  body('code')
    .trim()
    .escape()
    .isLength({ min: 3, max: 20 })
    .withMessage('Code must be 3-20 characters')
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage('Code can only contain letters, numbers, dash or underscore'),

  body('discountType')
    .isIn(['percentage', 'fixed'])
    .withMessage('Invalid discount type'),

  body('discountValue')
    .isFloat({ gt: 0 })
    .withMessage('Discount value must be a positive number'),

  body('startDate')
    .isISO8601()
    .toDate()
    .withMessage('Start date must be a valid date'),

  body('endDate')
    .isISO8601()
    .toDate()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.startDate)) {
        throw new Error('End date cannot be before start date');
      }
      return true;
    }),

  body('active')
    .optional()
    .isBoolean()
    .withMessage('Active must be true or false'),

  handleValidation,
];

// User: Validate promotion code (query param)
const validatePromotionCode = [
  query('code')
    .trim()
    .escape()
    .isLength({ min: 3, max: 20 })
    .withMessage('Promotion code must be 3-20 characters')
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage('Promotion code can only contain letters, numbers, dash or underscore'),

  handleValidation,
];

module.exports = {
  validatePromotionInput,
  validatePromotionCode,
};
