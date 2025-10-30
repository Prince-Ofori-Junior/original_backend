const { pool } = require("../../config/db");
const logger = require("../../config/logger");

const DEFAULT_STATUS = "pending";
const DEFAULT_COURIER = "Default Courier";

// -------------------- GET OR CREATE DELIVERY (atomic) --------------------
const getOrCreateDelivery = async (orderId, client = pool) => {
  const { rows } = await client.query(
    `SELECT * FROM deliveries WHERE order_id = $1 LIMIT 1`,
    [orderId]
  );
  if (rows[0]) return rows[0];

  const { rows: createdRows } = await client.query(
    `INSERT INTO deliveries (order_id, address, courier, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
    [orderId, "No address provided", DEFAULT_COURIER, DEFAULT_STATUS]
  );

  logger.info(`📦 Auto-created delivery for order ${orderId}`);
  return createdRows[0];
};

// -------------------- CREATE DELIVERY --------------------
const createDelivery = async ({ orderId, address, courier, status }) => {
  const existing = await getOrCreateDelivery(orderId);
  if (existing) return existing;

  const { rows } = await pool.query(
    `INSERT INTO deliveries (order_id, address, courier, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
    [orderId, address || "No address provided", courier || DEFAULT_COURIER, status || DEFAULT_STATUS]
  );

  logger.info(`📦 Delivery created for order ${orderId}`);
  return rows[0];
};

// -------------------- UPDATE DELIVERY & ORDER STATUS --------------------
const updateDeliveryStatusByOrder = async (orderId, status) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const delivery = await getOrCreateDelivery(orderId, client);

    const { rows: deliveryRows } = await client.query(
      `UPDATE deliveries SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, delivery.id]
    );

    await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, orderId]
    );

    await client.query("COMMIT");
    logger.info(`🚚 Delivery and order #${orderId} status updated to '${status}'`);

    return deliveryRows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// -------------------- ASSIGN COURIER --------------------
const assignCourierByOrder = async (orderId, courier) => {
  if (!courier) courier = DEFAULT_COURIER;

  const delivery = await getOrCreateDelivery(orderId);

  const { rows } = await pool.query(
    `UPDATE deliveries SET courier = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [courier, delivery.id]
  );

  logger.info(`👤 Courier '${courier}' assigned to delivery for order #${orderId}`);
  return rows[0];
};

// -------------------- LIST DELIVERIES --------------------
const getAllDeliveries = async () => {
  const { rows } = await pool.query(`
    SELECT d.id AS delivery_id, d.order_id, d.address, d.courier, d.status,
           d.created_at, d.updated_at,
           o.total_amount, o.status AS order_status,
           u.name AS customer_name, u.email
    FROM deliveries d
    JOIN orders o ON d.order_id = o.id
    JOIN users u ON o.user_id = u.id
    ORDER BY d.created_at DESC
  `);
  return rows;
};

// -------------------- LIST COURIERS --------------------
const getAllCouriers = async () => {
  const { rows } = await pool.query(`
    SELECT DISTINCT courier FROM deliveries WHERE courier IS NOT NULL ORDER BY courier ASC
  `);
  return rows.map(r => ({ name: r.courier }));
};

module.exports = {
  createDelivery,
  getAllDeliveries,
  getAllCouriers,
  updateDeliveryStatusByOrder,
  assignCourierByOrder,
  getOrCreateDelivery,
};
