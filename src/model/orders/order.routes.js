// modules/orders/order.routes.js
const express = require("express");
const bodyParser = require("body-parser");

const {
  createOrder,
  getOrder,
  listUserOrders,
  listAllOrders,
  paystackWebhook,
  verifyOrder,
} = require("./order.controller");

const { protect } = require("../../middleware/authMiddleware");
const { authorizeRoles } = require("../../middleware/roleMiddleware");
const rateLimit = require("../../middleware/rateLimiter");

const router = express.Router();

/* =======================================================
 🛒 ORDER ROUTES
======================================================= */

// ✅ Create new order (COD, Card, Momo)
router.post(
  "/",
  protect,
  rateLimit({ max: 10, windowMs: 5 * 60 * 1000 }), // max 10 requests per 5 mins
  createOrder
);

// ✅ Get logged-in user's orders
router.get("/my-orders", protect, listUserOrders);

// ✅ Admin: get all orders
router.get("/", protect, authorizeRoles("admin"), listAllOrders);

// ✅ Get specific order by ID
router.get("/:orderId", protect, getOrder);

/* =======================================================
 💳 PAYSTACK PAYMENT ROUTES
======================================================= */

// ✅ Verify Paystack transaction manually (frontend triggered)
router.get("/paystack/verify/:reference", protect, verifyOrder);

// ✅ Paystack webhook (signature verification requires raw body)
router.post(
  "/paystack/webhook",
  bodyParser.raw({ type: "application/json" }),
  paystackWebhook
);

/* =======================================================
 ✅ FALLBACK / SAFETY
======================================================= */

// Catch-all invalid /orders routes
router.use((req, res) => {
  res.status(404).json({ success: false, message: "Invalid orders route" });
});

module.exports = router;
