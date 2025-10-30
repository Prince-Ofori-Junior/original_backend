const express = require("express");
const rateLimit = require("express-rate-limit");
const pool = require("../config/db");
const Joi = require("joi");
let redisClient;
try { redisClient = require("../config/redis"); } catch {}

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Rate limiter
const dashboardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many dashboard requests. Try again later." },
});
router.use(dashboardLimiter);

// Authentication & authorization
router.use(protect);
router.use(authorize(['admin']));

// --- Cache helpers ---
const cache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 min fallback

async function getCached(key) {
  if (redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);
    } catch { /* fail silently */ }
  }
  const cached = cache[key];
  if (cached && Date.now() < cached.expiresAt) return cached.value;
  return null;
}

async function setCached(key, value, ttl = CACHE_DURATION) {
  if (redisClient) {
    try { await redisClient.set(key, JSON.stringify(value), { ex: Math.floor(ttl / 1000) }); } catch {}
  }
  cache[key] = { value, expiresAt: Date.now() + ttl };
}

// --- Validation schema ---
const dateSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
});

// --- ROUTES ---

// 1️⃣ Overview
router.get("/overview", async (req, res, next) => {
  try {
    const cached = await getCached("overview");
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const results = await Promise.allSettled([
      pool.query("SELECT COALESCE(SUM(total_amount),0) AS total_sales FROM orders"),
      pool.query("SELECT COUNT(*) AS total_users FROM users"),
      pool.query("SELECT COUNT(*) AS total_products FROM products"),
      pool.query("SELECT COUNT(*) AS total_orders FROM orders")
    ]);

    const overview = {
      totalSales: results[0].status === "fulfilled" ? results[0].value.rows[0].total_sales : 0,
      totalUsers: results[1].status === "fulfilled" ? results[1].value.rows[0].total_users : 0,
      totalProducts: results[2].status === "fulfilled" ? results[2].value.rows[0].total_products : 0,
      totalOrders: results[3].status === "fulfilled" ? results[3].value.rows[0].total_orders : 0,
      lastUpdated: new Date().toISOString()
    };

    await setCached("overview", overview);
    res.json({ success: true, data: overview, message: "Overview fetched successfully" });
  } catch (err) { next(err); }
});

// 2️⃣ Sales trends
router.get("/sales-trends", async (req, res, next) => {
  try {
    const { error, value } = dateSchema.validate(req.query);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { startDate, endDate } = value;
    const cacheKey = `salesTrends:${startDate || "all"}:${endDate || "all"}`;
    const cached = await getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    let query = "SELECT DATE(created_at) AS date, SUM(total_amount) AS total_sales FROM orders";
    const params = [];
    if (startDate && endDate) { query += " WHERE created_at BETWEEN $1 AND $2"; params.push(startDate, endDate); }
    query += " GROUP BY DATE(created_at) ORDER BY DATE(created_at) DESC LIMIT 30";

    const result = await pool.query(query, params);
    await setCached(cacheKey, result.rows);
    res.json({ success: true, data: result.rows, message: "Sales trends fetched successfully" });
  } catch (err) { next(err); }
});

// 3️⃣ User growth
router.get("/user-growth", async (req, res, next) => {
  try {
    const { error, value } = dateSchema.validate(req.query);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { startDate, endDate } = value;
    const cacheKey = `userGrowth:${startDate || "all"}:${endDate || "all"}`;
    const cached = await getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    let query = "SELECT DATE(created_at) AS date, COUNT(*) AS new_users FROM users";
    const params = [];
    if (startDate && endDate) { query += " WHERE created_at BETWEEN $1 AND $2"; params.push(startDate, endDate); }
    query += " GROUP BY DATE(created_at) ORDER BY DATE(created_at) DESC LIMIT 30";

    const result = await pool.query(query, params);
    await setCached(cacheKey, result.rows);
    res.json({ success: true, data: result.rows, message: "User growth fetched successfully" });
  } catch (err) { next(err); }
});

// 4️⃣ Top products
router.get("/top-products", async (req, res, next) => {
  try {
    const { error, value } = dateSchema.validate(req.query);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { limit = 5 } = value;
    const cacheKey = `topProducts:${limit}`;
    const cached = await getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const result = await pool.query(`
      SELECT p.id, p.name, SUM(oi.quantity) AS total_sold,
             SUM(oi.quantity * oi.price) AS total_revenue,
             MAX(p.image_url) AS image
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY p.id, p.name
      ORDER BY total_sold DESC
      LIMIT $1
    `, [limit]);

    await setCached(cacheKey, result.rows);
    res.json({ success: true, data: result.rows, message: "Top products fetched successfully" });
  } catch (err) { next(err); }
});

module.exports = router;
