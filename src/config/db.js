// src/config/db.js
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const dotenv = require("dotenv");

// Load environment-specific .env file
const envFile = `.env.${process.env.NODE_ENV || "development"}`;
dotenv.config({ path: envFile });

// Determine environment
const isProduction = process.env.NODE_ENV === "production";

// Use DATABASE_URL universally, fallback for dev/prod compatibility
const connectionString =
  process.env.DATABASE_URL ||
  (isProduction ? process.env.PROD_DATABASE_URL : process.env.DEV_DATABASE_URL);

if (!connectionString) {
  logger.error(`❌ DATABASE URL not set for current environment (${envFile})`);
  process.exit(1);
}

// SSL option controlled via environment variable
const sslOption =
  isProduction && process.env.PROD_DATABASE_SSL === "true"
    ? { rejectUnauthorized: false }
    : false;

// Configure Pool with production-grade settings
const pool = new Pool({
  connectionString,
  ssl: sslOption,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: false,
});

// -------------------- DATABASE CONNECTION --------------------
const connectDB = async (retries = 5, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.connect(); // ✅ connect works now
      logger.info(`🔌 Connected to PostgreSQL successfully (${process.env.NODE_ENV})`);
      return;
    } catch (err) {
      logger.error(`❌ PostgreSQL connection failed: ${err.message}`, { stack: err.stack });
      if (i < retries - 1) {
        logger.warn(`Retrying in ${delay}ms... (${i + 1}/${retries})`);
        await new Promise((res) => setTimeout(res, delay));
      } else {
        logger.error("💥 All connection attempts failed. Exiting...");
        process.exit(1);
      }
    }
  }
};

// -------------------- DATABASE INITIALIZATION --------------------
const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const migrationsDir = path.join(__dirname, "../database/migrations");
    const seedersDir = path.join(__dirname, "../database/seeders");

    // Apply migrations
    if (fs.existsSync(migrationsDir)) {
      const migrations = fs.readdirSync(migrationsDir).sort();
      for (const file of migrations) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        await client.query(sql);
      }
    }

    // Apply seeders
    if (fs.existsSync(seedersDir)) {
      const seeders = fs.readdirSync(seedersDir).sort();
      for (const file of seeders) {
        const sql = fs.readFileSync(path.join(seedersDir, file), "utf8");
        await client.query(sql);
      }
    }

    await client.query("COMMIT");
    logger.info("🎯 Database initialized successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error(`❌ Database initialization failed: ${err.message}`, { stack: err.stack });
    throw err;
  } finally {
    client.release();
  }
};

// -------------------- SAFE QUERY HELPER --------------------
const query = async (text, params = []) => {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`📦 Query executed in ${duration}ms: ${text}`);
    return res;
  } catch (err) {
    logger.error(`❌ Query failed: ${err.message} | SQL: ${text}`, { stack: err.stack });
    throw err;
  }
};

// -------------------- EXPORT --------------------
// ✅ Destructure-friendly export
module.exports = {
  pool,
  connectDB,
  initializeDatabase,
  query,
};
