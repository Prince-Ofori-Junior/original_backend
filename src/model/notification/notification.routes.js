const express = require("express");
const { body, validationResult } = require("express-validator");
const {
  sendNotification,
  getUserNotifications,
  listNotifications,
} = require("./notification.controller");
const { markNotificationAsReadService } = require("./notification.service");
const { protect } = require("../../middleware/authMiddleware");
const { authorizeRoles } = require("../../middleware/roleMiddleware");

const router = express.Router();

// -------------------- VALIDATION MIDDLEWARE --------------------
const validateNotification = [
  body("targetUserId").notEmpty().withMessage("targetUserId is required"),
  body("type").isIn(["email", "sms", "push"]).withMessage("Invalid notification type"),
  body("title").isString().trim().isLength({ min: 3 }).withMessage("Title is required"),
  body("message").isString().trim().isLength({ min: 3 }).withMessage("Message is required"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

// -------------------- USER ROUTES --------------------
router.get("/", protect, getUserNotifications);

// -------------------- MARK AS READ --------------------
router.patch("/:id/read", protect, async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await markNotificationAsReadService(id);
    res.json({ success: true, notification });
  } catch (err) {
    next(err);
  }
});

// -------------------- ADMIN ROUTES --------------------
router.post("/", protect, authorizeRoles("admin"), validateNotification, sendNotification);
router.get("/all", protect, authorizeRoles("admin"), listNotifications);

module.exports = router;
