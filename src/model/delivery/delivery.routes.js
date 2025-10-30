const express = require("express");
const { body, param, validationResult } = require("express-validator");
const {
  createDelivery,
  getDelivery,
  updateStatus,
  assignCourier,
  listDeliveries,
  getCouriers,
} = require("./delivery.controller");
const { protect } = require("../../middleware/authMiddleware");
const { authorizeRoles } = require("../../middleware/roleMiddleware");

const router = express.Router();

// ✅ Allowed delivery statuses
const VALID_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "completed",
  "cancelled",
  "failed",
  "returned",
  "refunded",
];

/* -------------------------------------------------------------------------- */
/* 🧍‍♂️ PUBLIC (AUTHENTICATED USER) ROUTES */
/* -------------------------------------------------------------------------- */

// Get a single delivery by order ID (customer view)
router.get(
  "/:orderId",
  protect,
  param("orderId").isUUID().withMessage("Invalid order ID"),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    getDelivery(req, res, next);
  }
);

/* -------------------------------------------------------------------------- */
/* 🧑‍💼 ADMIN / MANAGER ROUTES */
/* -------------------------------------------------------------------------- */

router.use(protect, authorizeRoles("admin", "manager"));

// Get all deliveries
router.get("/", listDeliveries);

// Get all unique couriers
router.get("/couriers/all", getCouriers);

// Create a new delivery
router.post(
  "/",
  body("orderId").isUUID().withMessage("Valid order ID required"),
  body("address").notEmpty().withMessage("Address is required"),
  body("courier").optional(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    createDelivery(req, res, next);
  }
);

// Update delivery status
router.patch(
  "/:orderId/status",
  param("orderId").isUUID().withMessage("Invalid order ID"),
  body("status")
    .isIn(VALID_STATUSES)
    .withMessage(`Status must be one of: ${VALID_STATUSES.join(", ")}`),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    updateStatus(req, res, next);
  }
);

// Assign or reassign courier
router.patch(
  "/:orderId/courier",
  param("orderId").isUUID().withMessage("Invalid order ID"),
  body("courier").notEmpty().withMessage("Courier name required"),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    assignCourier(req, res, next);
  }
);

module.exports = router;
