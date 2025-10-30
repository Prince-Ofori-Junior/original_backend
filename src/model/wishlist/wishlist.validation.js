const { body, validationResult } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({ field: err.param, message: err.msg })),
    });
  }
  next();
};

// Accept either number or UUID
const productIdValidation = body("productId")
  .exists({ checkFalsy: true })
  .withMessage("Product ID is required.")
  .bail()
  .custom((value) => {
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof value === "number" || uuidV4Regex.test(value)) return true;
    throw new Error("Product ID must be a number or valid UUID v4");
  });

const addWishlistValidation = [productIdValidation, handleValidationErrors];
const removeWishlistValidation = [productIdValidation, handleValidationErrors];

module.exports = { addWishlistValidation, removeWishlistValidation };
