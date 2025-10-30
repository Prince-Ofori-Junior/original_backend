// modules/reviews/review.routes.js
const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { addReview, getProductReviews, updateReview, deleteReview } = require("./review.controller");
const { protect } = require("../../middleware/authMiddleware");

const router = express.Router();

// ---------------- Middleware for input validation ----------------
const validateReviewInput = [
  body("productId").isInt().withMessage("productId must be a valid integer"),
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
  body("comment").isString().isLength({ min: 1, max: 1000 }).withMessage("Comment must be 1-1000 characters long"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  },
];

const validateReviewIdParam = [
  param("reviewId").isInt().withMessage("reviewId must be a valid integer"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  },
];

const validateProductIdParam = [
  param("productId").isInt().withMessage("productId must be a valid integer"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  },
];

// ---------------- Routes ----------------

// Public: Get product reviews
router.get("/:productId", validateProductIdParam, getProductReviews);

// Auth required: Add review
router.post("/", protect, validateReviewInput, addReview);

// Auth required: Update review
router.put("/:reviewId", protect, validateReviewIdParam, validateReviewInput, updateReview);

// Auth required: Delete review
router.delete("/:reviewId", protect, validateReviewIdParam, deleteReview);

module.exports = router;
