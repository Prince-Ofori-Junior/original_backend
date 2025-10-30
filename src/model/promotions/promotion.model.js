// modules/promotions/promotion.model.js
const pool = require("../../config/db");
const { isValidCode, sanitizeInput } = require("../../utils/validation");

// ------------------ Create a new promotion ------------------
const createPromotion = async ({ code, discount, type, expiresAt, usageLimit }) => {
  if (!code || !discount || !type || !expiresAt) {
    throw new Error("Missing required promotion fields");
  }

  const sanitizedCode = sanitizeInput(code.trim().toUpperCase());
  const sanitizedType = sanitizeInput(type.trim().toLowerCase());
  const expiryDate = new Date(expiresAt);

  const query = `
    INSERT INTO promotions (code, discount, type, expires_at, usage_limit)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const values = [sanitizedCode, parseFloat(discount), sanitizedType, expiryDate, usageLimit || null];

  const { rows } = await pool.query(query, values);
  return rows[0];
};

// ------------------ Update promotion ------------------
const updatePromotion = async (id, updates) => {
  if (!id) throw new Error("Promotion ID is required");

  const fields = [];
  const values = [];
  let idx = 1;

  for (const key in updates) {
    if (updates[key] !== undefined && updates[key] !== null) {
      fields.push(`${key} = $${idx}`);
      if (key === "discount") values.push(parseFloat(updates[key]));
      else if (key === "expiresAt") values.push(new Date(updates[key]));
      else values.push(sanitizeInput(updates[key]));
      idx++;
    }
  }

  if (!fields.length) throw new Error("No valid fields to update");

  const query = `
    UPDATE promotions
    SET ${fields.join(", ")}
    WHERE id = $${idx}
    RETURNING *;
  `;
  values.push(id);

  const { rows } = await pool.query(query, values);
  return rows[0];
};

// ------------------ Delete promotion ------------------
const deletePromotion = async (id) => {
  if (!id) throw new Error("Promotion ID is required");

  const query = `DELETE FROM promotions WHERE id = $1 RETURNING *;`;
  const { rows } = await pool.query(query, [id]);
  return rows[0];
};

// ------------------ Get promotion by code ------------------
const getPromotionByCode = async (code) => {
  if (!code || !isValidCode(code)) throw new Error("Invalid promotion code");

  const sanitizedCode = sanitizeInput(code.trim().toUpperCase());
  const query = `
    SELECT *
    FROM promotions
    WHERE code = $1 AND expires_at > NOW() AND (usage_limit IS NULL OR usage_limit > 0)
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [sanitizedCode]);
  return rows[0];
};

// ------------------ List all promotions ------------------
const listPromotions = async () => {
  const query = `
    SELECT *
    FROM promotions
    ORDER BY created_at DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};

module.exports = {
  createPromotion,
  updatePromotion,
  deletePromotion,
  getPromotionByCode,
  listPromotions,
};
