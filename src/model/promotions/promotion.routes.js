// modules/promotions/promotion.routes.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  createPromo,
  updatePromo,
  deletePromo,
  checkPromo,
  listAllPromos,
} = require("./promotion.controller");
const { protect } = require("../../middleware/authMiddleware");
const { authorizeRoles } = require("../../middleware/roleMiddleware");
const {
  validatePromotionInput,
  validatePromotionCode,
} = require("../../utils/validation");

const router = express.Router();

// ----------------- Rate Limiters -----------------
// Admin routes limiter
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // max 20 requests per minute per IP
  message:
    "Too many admin promotion requests from this IP, please try again later",
});

// User routes limiter
const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // max 5 requests per minute per IP
  message:
    "Too many promotion validation requests from this IP, please try again later",
});

// ----------------- Admin Routes -----------------

// Create a promotion
router.post(
  "/",
  protect,
  authorizeRoles("admin"),
  adminLimiter,
  validatePromotionInput,
  createPromo
);

// Update a promotion
router.put(
  "/:id",
  protect,
  authorizeRoles("admin"),
  adminLimiter,
  validatePromotionInput,
  updatePromo
);

// Delete a promotion
router.delete(
  "/:id",
  protect,
  authorizeRoles("admin"),
  adminLimiter,
  deletePromo
);

// List all promotions
router.get(
  "/all",
  protect,
  authorizeRoles("admin"),
  adminLimiter,
  listAllPromos
);

// ----------------- User Routes -----------------

// Validate a promotion code
router.get(
  "/validate",
  protect,
  userLimiter,
  validatePromotionCode,
  checkPromo
);

// ----------------- Export -----------------
module.exports = router;
