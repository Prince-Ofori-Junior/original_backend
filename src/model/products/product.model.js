const { pool } = require("../../config/db");
const logger = require("../../config/logger");

// ------------------ Serializer ------------------
const serializeProduct = (product) => ({
  ...product,
  id: product.id.toString(),
  category_id: product.category_id?.toString(),
  price: Number(product.price),
  stock: Number(product.stock),
  discountPrice: product.discount_price ?? null, // <-- ADD THIS
  created_at: product.created_at?.toISOString(),
  updated_at: product.updated_at?.toISOString(),
});


// ------------------ Products ------------------
const createProduct = async ({ name, description, price, stock, category_id, imageUrl }) => {
  const result = await pool.query(
    `INSERT INTO products 
      (name, description, price, stock, category_id, image_url, created_at, updated_at, is_active) 
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), true) 
     RETURNING *`,
    [name, description, price, stock, category_id, imageUrl]
  );
  logger.info(`📦 Product created: ${result.rows[0].id}`);
  return serializeProduct(result.rows[0]);
};

const getProducts = async ({
  page = 1,
  limit = 20,
  sortBy = "createdAt",
  order = "desc",
  category,
  search,
} = {}) => {
  const offset = (page - 1) * limit;
  limit = Math.min(limit, 100);

  const sortMap = {
    id: "p.id",
    name: "p.name",
    price: "p.price",
    stock: "p.stock",
    createdAt: "p.created_at",
    updatedAt: "p.updated_at",
    category: "c.name",
  };
  const sortColumn = sortMap[sortBy] || "p.created_at";
  order = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

  // --- Base Query ---
  let baseQuery = `
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = true
  `;

  const conditions = [];
  const values = [];

  if (category) {
    values.push(category);
    conditions.push(`c.id = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`p.name ILIKE $${values.length}`);
  }

  if (conditions.length > 0) {
    baseQuery += " AND " + conditions.join(" AND ");
  }

  // --- Main Data Query ---
  const dataQuery = `
    SELECT p.*, c.name AS category_name
    ${baseQuery}
    ORDER BY ${sortColumn} ${order}
    LIMIT $${values.length + 1} OFFSET $${values.length + 2};
  `;

  const result = await pool.query(dataQuery, [...values, limit, offset]);
  const serializedRows = result.rows.map(serializeProduct);

  // --- Count Query ---
  const countQuery = `
    SELECT COUNT(*) AS total
    ${baseQuery};
  `;
  const countResult = await pool.query(countQuery, values);
  const total = parseInt(countResult.rows[0].total, 10);

  return { rows: serializedRows, total };
};
 
const getProductById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM products WHERE id = $1 AND is_active = true",
    [id]
  );
  if (!result.rows[0]) return null;

  const product = serializeProduct(result.rows[0]);

  // ------------------ Related Products ------------------
  let related = [];
  if (product.category_id) {
    const relatedQuery = `
      SELECT * FROM products 
      WHERE category_id = $1 AND id != $2 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const relatedResult = await pool.query(relatedQuery, [product.category_id, id]);
    related = relatedResult.rows.map(serializeProduct); // discountPrice now included
  }

  return { ...product, related };
};


const updateProduct = async (id, fields) => {
  const keys = Object.keys(fields);
  if (!keys.length) return null;

  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = Object.values(fields);

  const result = await pool.query(
    `UPDATE products 
     SET ${setClause}, updated_at = NOW() 
     WHERE id = $${keys.length + 1} AND is_active = true 
     RETURNING *`,
    [...values, id]
  );

  if (!result.rows[0]) return null;
  logger.info(`✏️ Product updated: ${id}`);
  return serializeProduct(result.rows[0]);
};

const deleteProduct = async (id) => {
  const result = await pool.query(
    "UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *",
    [id]
  );
  if (!result.rows[0]) return false;
  logger.warn(`🗑️ Product soft-deleted: ${id}`);
  return true;
};

// ------------------ Categories ------------------
const createCategory = async (name, description = "") => {
  const result = await pool.query(
    `INSERT INTO categories (name, description, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW()) RETURNING *`,
    [name, description]
  );
  logger.info(`🗂️ Category created: ${result.rows[0].id}`);
  return result.rows[0];
};

const getCategories = async () => {
  const result = await pool.query("SELECT * FROM categories ORDER BY name ASC");
  return result.rows;
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  createCategory,
  getCategories, 
};
   