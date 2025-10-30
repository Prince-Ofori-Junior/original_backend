// model/admin/admin.controller.js
const logger = require("../../config/logger");
const sanitize = require("sanitize-html");
const Joi = require("joi");
const { pool } = require("../../config/db");
const {
  listUsersService,
  setUserRoleService,
  deleteUserService,
  listOrdersService,
  listProductsService,
  toggleProductService,
  getStatsService,
} = require("./admin.service");
const { createUserService } = require("../auth/auth.service");
const { generateToken, generateRefreshToken } = require("../../utils/generateToken"); // ✅ fixed import

// -------------------- Async Error Wrapper --------------------
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    logger.error({
      message: "Admin Controller Error",
      error: err.message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
      user: req.user?.email || "N/A",
      ip: req.ip,
      userAgent: req.headers["user-agent"] || "N/A",
    });
    res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: "An unexpected server error occurred",
    });
  });

// -------------------- USERS --------------------
const listUsers = asyncHandler(async (_req, res) => {
  const users = await listUsersService();
  res.status(200).json({ success: true, data: users });
});

const updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ success: false, error: "INVALID_USER_ID" });
  }

  const allowedRoles = ["user", "seller", "admin"];
  if (!role || !allowedRoles.includes(role)) {
    return res.status(400).json({ success: false, error: "INVALID_ROLE" });
  }

  if (req.user?.id === userId) {
    return res.status(403).json({ success: false, error: "CANNOT_MODIFY_SELF_ROLE" });
  }

  const updatedUser = await setUserRoleService(userId, role);

  logger.info({
    message: "User role updated",
    admin: req.user?.email || "SYSTEM",
    targetUserId: userId,
    role,
    ip: req.ip,
  });

  res.status(200).json({
    success: true,
    message: "User role updated successfully",
    data: updatedUser,
  });
});

const removeUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ success: false, error: "INVALID_USER_ID" });
  }

  if (req.user?.id === userId) {
    return res.status(403).json({ success: false, error: "CANNOT_DELETE_SELF" });
  }

  const deletedUser = await deleteUserService(userId);

  logger.warn({
    message: "User deleted",
    admin: req.user?.email || "SYSTEM",
    targetUserId: userId,
    ip: req.ip,
  });

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
    data: deletedUser,
  });
});

// -------------------- ORDERS --------------------
const listOrders = asyncHandler(async (_req, res) => {
  const orders = await listOrdersService();
  res.status(200).json({ success: true, data: orders });
});

// -------------------- PRODUCTS --------------------
const listProducts = asyncHandler(async (_req, res) => {
  const products = await listProductsService();
  res.status(200).json({ success: true, data: products });
});

const toggleProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { isActive } = req.body;

  if (!productId || typeof productId !== "string") {
    return res.status(400).json({ success: false, error: "INVALID_PRODUCT_ID" });
  }

  if (typeof isActive !== "boolean") {
    return res.status(400).json({ success: false, error: "INVALID_IS_ACTIVE" });
  }

  const product = await toggleProductService(productId, isActive);

  logger.info({
    message: "Product status changed",
    admin: req.user?.email || "SYSTEM",
    productId,
    isActive,
    ip: req.ip,
  });

  res.status(200).json({
    success: true,
    message: "Product status updated successfully",
    data: product,
  });
});

// -------------------- DASHBOARD --------------------
const dashboardStats = asyncHandler(async (_req, res) => {
  const stats = await getStatsService();
  res.status(200).json({ success: true, data: stats });
});

// -------------------- TEMPORARY ADMIN CREATION --------------------
const fs = require("fs");
const path = require("path");

const createTemporaryAdmin = asyncHandler(async (req, res) => {
  // 🔐 Safety: only allow bootstrap if explicitly enabled
  if (process.env.ALLOW_BOOTSTRAP !== "true") {
    logger.warn({
      message: "Attempt to access bootstrap admin creation while disabled",
      ip: req.ip,
      user: req.user?.email || "N/A",
    });
    return res.status(403).json({ success: false, error: "BOOTSTRAP_DISABLED" });
  }

  // 🔹 Check if any admin already exists
  const { rows: admins } = await pool.query(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
  );

  if (admins.length > 0 && req.user?.role !== "admin") {
    return res.status(403).json({ success: false, error: "FORBIDDEN" });
  }

  // Validate input
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().max(100).required(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .json({ success: false, error: "INVALID_INPUT", details: error.details });
  }

  const { email, password, name } = value;
  const sanitizedEmail = sanitize(email);
  const sanitizedName = sanitize(name);

  let newAdmin;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const createdUser = await createUserService({
      email: sanitizedEmail,
      password,
      name: sanitizedName,
      role: "admin", // ✅ explicitly set role
    });
    newAdmin = createdUser;
    await client.query("COMMIT");

    // 🔐 Auto-disable bootstrap after success
    process.env.ALLOW_BOOTSTRAP = "false";
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, "utf8");
      if (envContent.includes("ALLOW_BOOTSTRAP=true")) {
        envContent = envContent.replace("ALLOW_BOOTSTRAP=true", "ALLOW_BOOTSTRAP=false");
        fs.writeFileSync(envPath, envContent, "utf8");
        logger.info({ message: "BOOTSTRAP auto-disabled in .env" });
      }
    }
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({
      message: "Failed to create temporary admin",
      error: err.message,
      stack: err.stack,
      admin: req.user?.email || "BOOTSTRAP",
      ip: req.ip,
    });
    return res
      .status(500)
      .json({ success: false, error: "SERVER_ERROR", message: err.message });
  } finally {
    client.release();
  }

  delete newAdmin.password;

  // 🔹 Auto-issue tokens for immediate login
  const accessToken = generateToken(newAdmin);
  const refreshToken = await generateRefreshToken(newAdmin);

  logger.info({
    message: "Temporary admin created",
    admin: req.user?.email || "BOOTSTRAP",
    newAdmin: sanitizedEmail,
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    message: "Temporary admin created successfully",
    data: newAdmin,
    accessToken,
    refreshToken,
  });
});

// -------------------- EXPORT --------------------
module.exports = {
  listUsers,
  updateUserRole,
  removeUser,
  listOrders,
  listProducts,
  toggleProduct,
  dashboardStats,
  createTemporaryAdmin,
};
