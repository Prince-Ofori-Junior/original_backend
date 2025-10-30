const { pool } = require("../../config/db");
const logger = require("../../config/logger");
const createError = require("http-errors");

/**
 * @desc Add a product to a user's wishlist
 * @param {string} userId - UUID
 * @param {string} productId - UUID
 * @returns {object|null} wishlist item with product info, or null if already exists
 */
const addToWishlist = async (userId, productId) => {
  try {
    const query = `
      INSERT INTO wishlists (user_id, product_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, product_id) DO NOTHING
      RETURNING id, user_id, product_id, created_at;
    `;
    const { rows } = await pool.query(query, [userId, productId]);

    // If nothing inserted, fetch the existing row
    let wishlistRow;
    if (rows.length === 0) {
      const existing = await pool.query(
        `SELECT id, user_id, product_id, created_at 
         FROM wishlists 
         WHERE user_id=$1 AND product_id=$2`,
        [userId, productId]
      );
      if (existing.rows.length === 0) return null;
      // Already exists → return null to controller for 409
      return null;
    } else {
      wishlistRow = rows[0];
    }

    // Fetch product info
    const prodQuery = `
      SELECT id, name, price, discount_price, image_url
      FROM products
      WHERE id=$1
    `;
    const prodRes = await pool.query(prodQuery, [productId]);
    if (prodRes.rows.length === 0) throw createError(404, "Product not found");

    return { ...wishlistRow, ...prodRes.rows[0] };
  } catch (err) {
    logger.error(`❌ addToWishlist failed: ${err.message}`);
    if (err.status) throw err;
    throw createError(500, "Failed to add product to wishlist");
  }
};

/**
 * @desc Remove a product from a user's wishlist
 * @param {string} userId - UUID
 * @param {string} productId - UUID
 * @returns {object|null} removed wishlist item with product info, or null if not found
 */
const removeFromWishlist = async (userId, productId) => {
  try {
    const query = `
      DELETE FROM wishlists
      WHERE user_id=$1 AND product_id=$2
      RETURNING id, user_id, product_id, created_at;
    `;
    const { rows } = await pool.query(query, [userId, productId]);
    if (rows.length === 0) return null; // Not found → controller responds 404

    const wishlistRow = rows[0];

    // Fetch product info
    const prodQuery = `
      SELECT id, name, price, discount_price, image_url
      FROM products
      WHERE id=$1
    `;
    const prodRes = await pool.query(prodQuery, [productId]);
    if (prodRes.rows.length === 0) throw createError(404, "Product not found");

    return { ...wishlistRow, ...prodRes.rows[0] };
  } catch (err) {
    logger.error(`❌ removeFromWishlist failed: ${err.message}`);
    if (err.status) throw err;
    throw createError(500, "Failed to remove product from wishlist");
  }
};

/**
 * @desc Get all wishlist items for a specific user
 * @param {string} userId - UUID
 * @returns {array} wishlist items
 */
const getUserWishlist = async (userId) => {
  try {
    const query = `
      SELECT 
        w.id AS wishlist_id,
        p.id AS product_id,
        p.name,
        p.price,
        p.discount_price,
        p.image_url,
        w.created_at
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC;
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows;
  } catch (err) {
    logger.error(`❌ getUserWishlist failed: ${err.message}`);
    throw createError(500, "Failed to fetch wishlist");
  }
};

/**
 * @desc List all wishlists for admin
 * @returns {array} all wishlists
 */
const listAllWishlists = async () => {
  try {
    const query = `
      SELECT 
        w.id AS wishlist_id,
        u.id AS user_id,
        u.name AS user_name,
        p.id AS product_id,
        p.name AS product_name,
        p.price,
        p.discount_price,
        p.image_url,
        w.created_at
      FROM wishlists w
      JOIN users u ON w.user_id = u.id
      JOIN products p ON w.product_id = p.id
      ORDER BY w.created_at DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
  } catch (err) {
    logger.error(`❌ listAllWishlists failed: ${err.message}`);
    throw createError(500, "Failed to fetch all wishlists");
  }
};

module.exports = {
  addToWishlist,
  removeFromWishlist,
  getUserWishlist,
  listAllWishlists,
};
