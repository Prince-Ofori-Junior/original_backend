// src/modules/wishlist/wishlist.routes.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  addWishlist,
  removeWishlist,
  getWishlist,
  listAllWishlist,
} = require("./wishlist.controller");
const { protect, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();

// ---------------- Rate Limiter ----------------
const wishlistLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 requests per window per IP
  message: { success: false, message: "Too many wishlist requests, try again later" },
});

// ---------------- User Wishlist Routes ----------------
router.post("/", protect, wishlistLimiter, addWishlist);
router.delete("/", protect, wishlistLimiter, removeWishlist);
router.get("/", protect, getWishlist);

// ---------------- Admin Routes ----------------
router.get("/all", protect, authorize(["admin"]), listAllWishlist);

module.exports = router;
