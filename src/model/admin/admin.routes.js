const express = require("express");
const router = express.Router();

const {
  listUsers,
  updateUserRole,
  removeUser,
  listOrders,
  listProducts,
  toggleProduct,
  dashboardStats,
  createTemporaryAdmin,
} = require("./admin.controller");

const {
  login,
  register,
  forgotPasswordController,
  resetPasswordController,
  logoutController,
} = require("../auth/auth.controller");

const { protect } = require("../../middleware/authMiddleware");
const { authorizeRoles } = require("../../middleware/roleMiddleware");

// =============================================================
// 🔐 AUTH ROUTES (PUBLIC)
// =============================================================
router.post("/auth/login", login);
router.post("/auth/register", register);
router.post("/auth/forgot-password", forgotPasswordController);
router.post("/auth/reset-password", resetPasswordController);

// Logout requires a valid token (so we use protect)
router.post("/auth/logout", protect, logoutController);

// =============================================================
// 🧩 BOOTSTRAP TEMP ADMIN (PUBLIC)
// =============================================================
// ⚠️ Only for first-time setup; disable in production!
router.post("/users/temp-admin", createTemporaryAdmin);

// =============================================================
// 🔒 PROTECTED ADMIN ROUTES
// =============================================================
// Everything below this requires an authenticated ADMIN
router.use(protect);
router.use(authorizeRoles("admin"));

// -------------------- USERS --------------------
router.get("/users", listUsers);
router.put("/users/:userId/role", updateUserRole);
router.delete("/users/:userId", removeUser);

// -------------------- ORDERS --------------------
router.get("/orders", listOrders);

// -------------------- PRODUCTS --------------------
router.get("/products", listProducts);
router.patch("/products/:productId/status", toggleProduct);

// -------------------- DASHBOARD --------------------
router.get("/dashboard/stats", dashboardStats);

module.exports = router;
