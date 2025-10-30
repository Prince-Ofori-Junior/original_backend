const express = require("express");
const { body, validationResult } = require("express-validator");
const {
  register,
  login,
  getMeController,
  refreshTokenController,
  forgotPasswordController,
  resetPasswordController,
  logoutController,
  getUserProfileController,
  upgradeToPremiumController,
  updateEmailController,
  updatePasswordController,
  requestPhoneOTPController,
  verifyPhoneOTPController,
  manageConnectedAccountsController,
} = require("./auth.controller");

const { protect } = require("../../middleware/authMiddleware");

const router = express.Router();

// -------------------- VALIDATORS --------------------
const validateRegister = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain an uppercase letter")
    .matches(/\d/).withMessage("Password must contain a number"),
  body("phone")
    .optional()
    .matches(/^\+?\d{7,15}$/)
    .withMessage("Phone number is invalid"),
  body("address")
    .optional()
    .isLength({ min: 5 })
    .withMessage("Address is too short"),
];

const validateLogin = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const validateEmailUpdate = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
];

const validatePasswordUpdate = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 }).withMessage("New password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("New password must contain an uppercase letter")
    .matches(/\d/).withMessage("New password must contain a number"),
];

const validatePhoneUpdate = [
  body("phone")
    .matches(/^\+?\d{7,15}$/)
    .withMessage("Phone number is invalid"),
];

const validateOTP = [
  body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
];

const validateConnectedAccounts = [
  body("provider").notEmpty().withMessage("Provider is required"),
  body("action").isIn(["connect", "disconnect"]).withMessage("Action must be 'connect' or 'disconnect'"),
];

// -------------------- VALIDATION HANDLER --------------------
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// -------------------- ROUTES --------------------

// Auth
router.post("/register", validateRegister, handleValidationErrors, register);
router.post("/login", validateLogin, handleValidationErrors, login);
router.post("/refresh", refreshTokenController);
router.post("/logout", protect, logoutController);

// Password
router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);

// Protected
router.get("/me", protect, getMeController);

// Profile
router.get("/profile", protect, getUserProfileController);

// Profile management
router.patch("/profile/email", protect, validateEmailUpdate, handleValidationErrors, updateEmailController);
router.patch("/profile/password", protect, validatePasswordUpdate, handleValidationErrors, updatePasswordController);

// Phone update with OTP
router.post("/profile/phone/request-otp", protect, validatePhoneUpdate, handleValidationErrors, requestPhoneOTPController);
router.post("/profile/phone/verify-otp", protect, validateOTP, handleValidationErrors, verifyPhoneOTPController);

// Connected accounts
router.patch("/profile/connected-accounts", protect, validateConnectedAccounts, handleValidationErrors, manageConnectedAccountsController);

// Premium
router.post("/upgrade-premium", protect, upgradeToPremiumController);

module.exports = router;
 