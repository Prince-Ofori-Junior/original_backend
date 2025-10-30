const {
  getAllUsers,
  updateUserRole,
  deleteUser,
  getAllOrders,
  getAllProducts,
  toggleProductStatus,
  getDashboardStats,
} = require("./admin.model");
const logger = require("../../config/logger");
const { validateUUID, validateRole } = require("../../utils/validators");
const createError = require("http-errors");

// USERS
const listUsersService = async () => {
  try {
    return await getAllUsers();
  } catch (err) {
    logger.error(`listUsersService failed: ${err.message}`);
    throw createError(500, "Failed to fetch users");
  }
};

const setUserRoleService = async (userId, role) => {
  if (!validateUUID(userId)) throw createError(400, "Invalid user ID");
  if (!validateRole(role)) throw createError(400, "Invalid role");

  try {
    const updated = await updateUserRole(userId, role);
    if (!updated) throw createError(404, "User not found");
    return updated;
  } catch (err) {
    logger.error(`setUserRoleService failed: ${err.message}`);
    throw createError(500, "Failed to update user role");
  }
};

const deleteUserService = async (userId) => {
  if (!validateUUID(userId)) throw createError(400, "Invalid user ID");

  try {
    const deleted = await deleteUser(userId);
    if (!deleted) throw createError(404, "User not found");
    return deleted;
  } catch (err) {
    logger.error(`deleteUserService failed: ${err.message}`);
    throw createError(500, "Failed to delete user");
  }
};

// ORDERS
const listOrdersService = async () => {
  try {
    return await getAllOrders();
  } catch (err) {
    logger.error(`listOrdersService failed: ${err.message}`);
    throw createError(500, "Failed to fetch orders");
  }
};

// PRODUCTS
const listProductsService = async () => {
  try {
    return await getAllProducts();
  } catch (err) {
    logger.error(`listProductsService failed: ${err.message}`);
    throw createError(500, "Failed to fetch products");
  }
};

const toggleProductService = async (productId, isActive) => {
  if (!validateUUID(productId)) throw createError(400, "Invalid product ID");
  if (typeof isActive !== "boolean") throw createError(400, "isActive must be boolean");

  try {
    const product = await toggleProductStatus(productId, isActive);
    if (!product) throw createError(404, "Product not found");
    return product;
  } catch (err) {
    logger.error(`toggleProductService failed: ${err.message}`);
    throw createError(500, "Failed to update product status");
  }
};

// DASHBOARD
const getStatsService = async () => {
  try {
    return await getDashboardStats();
  } catch (err) {
    logger.error(`getStatsService failed: ${err.message}`);
    throw createError(500, "Failed to fetch stats");
  }
};

module.exports = {
  listUsersService,
  setUserRoleService,
  deleteUserService,
  listOrdersService,
  listProductsService,
  toggleProductService,
  getStatsService,
};
