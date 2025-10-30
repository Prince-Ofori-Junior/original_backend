const { pool } = require("../../config/db");
const logger = require("../../config/logger");

/**
 * --- USERS ---
 */
const getAllUsers = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, is_active, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );
    return rows;
  } catch (err) {
    logger.error(`getAllUsers failed: ${err.message}`);
    throw new Error("Failed to fetch users");
  }
};

const updateUserRole = async (userId, role) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, role, is_active`,
      [role, userId]
    );
    return rows[0];
  } catch (err) {
    logger.error(`updateUserRole failed for userId=${userId}: ${err.message}`);
    throw new Error("Failed to update user role");
  }
};

const deleteUser = async (userId) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [userId]
    );
    return rows[0];
  } catch (err) {
    logger.error(`deleteUser failed for userId=${userId}: ${err.message}`);
    throw new Error("Failed to delete user");
  }
};

/**
 * --- ORDERS ---
 */
const getAllOrders = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.total_amount, o.status, o.created_at, u.name AS user_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );
    return rows;
  } catch (err) {
    logger.error(`getAllOrders failed: ${err.message}`);
    throw new Error("Failed to fetch orders");
  }
};

/**
 * --- PRODUCTS ---
 */
const getAllProducts = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, price, stock, is_active, created_at, updated_at
       FROM products
       ORDER BY created_at DESC`
    );
    return rows;
  } catch (err) {
    logger.error(`getAllProducts failed: ${err.message}`);
    throw new Error("Failed to fetch products");
  }
};

const toggleProductStatus = async (productId, isActive) => {
  try {
    const { rows } = await pool.query(
      `UPDATE products
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, is_active`,
      [isActive, productId]
    );
    return rows[0];
  } catch (err) {
    logger.error(`toggleProductStatus failed for productId=${productId}: ${err.message}`);
    throw new Error("Failed to update product status");
  }
};

/**
 * --- DASHBOARD STATS ---
 */
const getDashboardStats = async () => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM products) AS total_products,
        (SELECT COUNT(*) FROM orders) AS total_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed') AS total_revenue;
    `);
    return rows[0];
  } catch (err) {
    logger.error(`getDashboardStats failed: ${err.message}`);
    throw new Error("Failed to fetch dashboard stats");
  }
};

module.exports = {
  getAllUsers,
  updateUserRole,
  deleteUser,
  getAllOrders,
  getAllProducts,
  toggleProductStatus,
  getDashboardStats,
};
