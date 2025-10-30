const {
  createDeliveryService,
  getDeliveryByOrderService,
  updateDeliveryStatusService,
  assignCourierByOrderService,
  listDeliveriesService,
  getCouriersService,
} = require("./delivery.service");

const logger = require("../../config/logger");
const { pool } = require("../../config/db");
const { createNotification } = require("../notification/notification.controller");
const nodemailerTransporter = require("../../config/mailer");

// -------------------- HELPER: ENSURE DELIVERY --------------------
const ensureDeliveryForOrder = async (orderId) => {
  try {
    const delivery = await getDeliveryByOrderService(orderId, false);
    return delivery;
  } catch (err) {
    if (err.status === 404) {
      const { rows } = await pool.query(
        "SELECT address FROM orders WHERE id = $1 LIMIT 1",
        [orderId]
      );
      const orderAddress = rows[0]?.address || "No address provided";
      const delivery = await createDeliveryService(orderId, orderAddress, "Default Courier");
      logger.info(`📦 Auto-created delivery for order ${orderId}`);
      return delivery;
    } else {
      throw err;
    }
  }
};

// -------------------- UPDATE DELIVERY STATUS --------------------
const updateStatus = async (req, res, next) => {
  const client = await pool.connect();

  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can update status" });
    }

    const { orderId } = req.params;
    const { status } = req.body;

    await client.query("BEGIN");

    const delivery = await ensureDeliveryForOrder(orderId);

    const updatedDelivery = await updateDeliveryStatusService(delivery.order_id, status);

    await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, orderId]
    );

    await client.query("COMMIT");

    // -------------------- Notify customer --------------------
    const { rows } = await client.query(
      `SELECT u.id AS user_id, u.name, u.email
       FROM users u
       JOIN orders o ON o.user_id = u.id
       WHERE o.id = $1 LIMIT 1`,
      [orderId]
    );

    const user = rows[0];

    if (user) {
      const io = req.app.get("io"); // Socket.IO instance

      // 1️⃣ Live message via Socket.IO
      if (io) {
        io.to(`user_${user.user_id}`).emit("delivery_status_update", {
          orderId,
          status,
          message: `Your delivery for order #${orderId} is now ${status}.`,
        });
      }

      // 2️⃣ Create in-app notification
      if (typeof createNotification === "function") {
        await createNotification({
          user_id: user.user_id,
          title: "Delivery Status Updated",
          message: `Your delivery for order #${orderId} is now ${status}.`,
          type: "delivery",
          link: `/orders/${orderId}`,
        });
      }

      // 3️⃣ Send email
      if (user.email && typeof nodemailerTransporter.sendMail === "function") {
        await nodemailerTransporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: `Delivery status updated: ${status}`,
          html: `<p>Hi ${user.name || "Customer"},</p>
                 <p>Your order <b>#${orderId}</b> delivery status is now <b>${status}</b>.</p>
                 <p>Thank you for shopping with us!</p>`,
        });
      }
    }

    res.json({ success: true, delivery: updatedDelivery, message: `Status updated to ${status}` });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error(`Updating delivery status failed: ${err.message}`);
    next(err);
  } finally {
    client.release();
  }
};

// -------------------- ASSIGN COURIER --------------------
const assignCourier = async (req, res, next) => {
  const client = await pool.connect();

  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can assign couriers" });
    }

    const { orderId } = req.params;
    const { courier } = req.body;
    if (!courier) return res.status(400).json({ success: false, message: "Courier required" });

    await client.query("BEGIN");

    const delivery = await ensureDeliveryForOrder(orderId);

    const updatedDelivery = await assignCourierByOrderService(delivery.order_id, courier);

    await client.query("COMMIT");

    // -------------------- Notify customer --------------------
    const { rows } = await client.query(
      `SELECT u.id AS user_id FROM users u JOIN orders o ON o.user_id = u.id WHERE o.id = $1 LIMIT 1`,
      [orderId]
    );

    const user = rows[0];
    if (user) {
      const io = req.app.get("io");
      if (io) {
        io.to(`user_${user.user_id}`).emit("courier_assigned", {
          orderId,
          courier,
          message: `A courier (${courier}) has been assigned to your order #${orderId}.`,
        });
      }
    }

    res.json({ success: true, delivery: updatedDelivery, message: `Courier assigned: ${courier}` });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error(`Assigning courier failed: ${err.message}`);
    next(err);
  } finally {
    client.release();
  }
};

// -------------------- GET DELIVERY --------------------
const getDelivery = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const delivery = await getDeliveryByOrderService(orderId, false);
    if (!delivery) return res.status(404).json({ success: false, message: "Delivery not found" });

    res.json({ success: true, delivery });
  } catch (err) {
    logger.error(`Fetching delivery failed: ${err.message}`);
    next(err);
  }
};

// -------------------- LIST DELIVERIES --------------------
const listDeliveries = async (_req, res, next) => {
  try {
    const deliveries = await listDeliveriesService();
    res.json({ success: true, deliveries });
  } catch (err) {
    logger.error(`Listing deliveries failed: ${err.message}`);
    next(err);
  }
};

// -------------------- GET COURIERS --------------------
const getCouriers = async (_req, res, next) => {
  try {
    const couriers = await getCouriersService();
    res.json({ success: true, couriers });
  } catch (err) {
    logger.error(`Fetching couriers failed: ${err.message}`);
    next(err);
  }
};

module.exports = {
  updateStatus,
  assignCourier,
  getDelivery,
  listDeliveries,
  getCouriers,
  ensureDeliveryForOrder,
};
