// modules/reviews/review.model.js
const pool = require("../../config/db");
const logger = require("../../config/logger");

// ---------------- Create a review ----------------
const createReview = async ({ productId, userId, rating, comment }) => {
  // Prevent multiple reviews by the same user for the same product
  const existing = await hasUserReviewed(productId, userId);
  if (existing) {
    throw new Error("User has already reviewed this product");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const query = `
      INSERT INTO reviews (product_id, user_id, rating, comment)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [productId, userId, rating, comment];
    const { rows } = await client.query(query, values);

    await client.query("COMMIT");
    logger.info(`Review ${rows[0].id} created by user ${userId} for product ${productId}`);
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("Failed to create review", err);
    throw err;
  } finally {
    client.release();
  }
};

// ---------------- Get reviews for a product ----------------
const getProductReviews = async (productId) => {
  const query = `
    SELECT r.id, r.rating, r.comment, r.created_at, r.updated_at,
           u.id as user_id, u.name as user_name
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.product_id = $1
    ORDER BY r.created_at DESC;
  `;
  const { rows } = await pool.query(query, [productId]);
  return rows;
};

// ---------------- Update review ----------------
const updateReview = async (reviewId, { rating, comment }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fields = [];
    const values = [];
    let idx = 1;

    if (rating !== undefined) {
      fields.push(`rating = $${idx++}`);
      values.push(rating);
    }
    if (comment !== undefined) {
      fields.push(`comment = $${idx++}`);
      values.push(comment);
    }

    if (!fields.length) throw new Error("No fields to update");

    // Always update timestamp
    fields.push(`updated_at = NOW()`);

    const query = `
      UPDATE reviews
      SET ${fields.join(", ")}
      WHERE id = $${idx}
      RETURNING *;
    `;
    values.push(reviewId);

    const { rows } = await client.query(query, values);
    await client.query("COMMIT");

    if (!rows[0]) throw new Error("Review not found");
    logger.info(`Review ${reviewId} updated`);
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error(`Failed to update review ${reviewId}`, err);
    throw err;
  } finally {
    client.release();
  }
};

// ---------------- Delete review ----------------
const deleteReview = async (reviewId) => {
  const query = `DELETE FROM reviews WHERE id = $1 RETURNING id;`;
  const { rows } = await pool.query(query, [reviewId]);

  if (!rows[0]) throw new Error("Review not found");
  logger.info(`Review ${reviewId} deleted`);
  return rows[0];
};

// ---------------- Check if user already reviewed product ----------------
const hasUserReviewed = async (productId, userId) => {
  const query = `SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2;`;
  const { rows } = await pool.query(query, [productId, userId]);
  return rows[0];
};

module.exports = {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  hasUserReviewed,
};
