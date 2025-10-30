const {
  placeOrderService,
  verifyOrderService,
  getUserOrdersService,
  getOrderService,
  listAllOrdersService,
} = require("./order.service");
const { getDeliveryByOrderService, createDeliveryService } = require("../delivery/delivery.service");
const logger = require("../../config/logger");
const Joi = require("joi");
const crypto = require("crypto");
const { pool } = require("../../config/db");

// ------------------- Validation -------------------
const orderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().guid({ version: "uuidv4" }).required(),
        quantity: Joi.number().integer().min(1).required(),
        price: Joi.number().positive().required(),
      })
    )
    .min(1)
    .required(),
  address: Joi.string().max(255).required(),
  paymentMethod: Joi.string().valid("cod", "card", "momo").required(),
  paymentChannel: Joi.string()
    .when("paymentMethod", { is: "card", then: Joi.string().valid("visa", "mastercard", "verve").required() })
    .when("paymentMethod", { is: "momo", then: Joi.string().valid("mtn", "vodafone", "airteltigo", "telecel").required() })
    .when("paymentMethod", { is: "cod", then: Joi.string().valid("cod_pickup").required() }),
  totalAmount: Joi.number().positive().required(),
  email: Joi.string().email().required(),
  isPremium: Joi.boolean().optional(),
});

// ------------------- Helper -------------------

// Find order by Paystack reference if metadata.orderId is missing
const findOrderByReference = async (reference) => {
  if (!reference) return null;
  try {
    const { rows } = await pool.query("SELECT * FROM orders WHERE reference = $1 LIMIT 1", [reference]);
    return rows[0] || null;
  } catch (err) {
    logger.error(`Failed to lookup order by reference ${reference}: ${err.message}`);
    return null;
  }
};

// Auto-create delivery for an order if missing
const ensureDeliveryForOrder = async (order) => {
  if (!order) throw new Error("Order is required to create delivery");
  const address = order.address || "No address provided";
  let delivery = await getDeliveryByOrderService(order.id, true); // autoCreate = true
  if (!delivery) {
    delivery = await createDeliveryService(order.id, address);
  }
  return delivery;
};

// ------------------- Controllers -------------------

// 1️⃣ Create Order & Initialize Payment
const createOrder = async (req, res, next) => {
  try {
    const { error } = orderSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { paymentMethod, paymentChannel, isPremium } = req.body;
    const { order, paymentData } = await placeOrderService(req.user.id, req.body);

    if (isPremium) order.is_premium = true;

    const frontendUrl = process.env.FRONTEND_URL;
    const backendUrl = process.env.BACKEND_URL;

    // ---------------- COD PAYMENT ----------------
    if (paymentMethod === "cod") {
      await ensureDeliveryForOrder(order);

      return res.status(201).json({
        success: true,
        order,
        message: "Order placed successfully with Cash on Delivery.",
        redirectUrl: `${frontendUrl}/payment-success?orderId=${order.id}`,
      });
    }

    // ---------------- PAYSTACK PAYMENT ----------------
    const callbackUrl = `${backendUrl}/api/orders/paystack/callback`;

    return res.status(201).json({
      success: true,
      order,
      payment: {
        method: paymentMethod,
        channel: paymentChannel,
        reference: paymentData.reference,
        authorizationUrl: paymentData.authorization_url,
        callbackUrl,
      },
      message: `Proceed to ${paymentMethod.toUpperCase()} payment via ${paymentChannel.toUpperCase()}.`,
    });
  } catch (err) {
    logger.error(`Order creation failed for user ${req.user.id}: ${err.message}`);
    next(err);
  }
};

// 2️⃣ Paystack Callback
const paystackCallback = async (req, res) => {
  const reference = req.query.reference;
  const frontendUrl = process.env.FRONTEND_URL;

  if (!reference) return res.redirect(`${frontendUrl}/payment-failed`);

  try {
    const verification = await verifyOrderService(reference);
    let orderId = verification?.orderId;

    if (!orderId) {
      const fallbackOrder = await findOrderByReference(reference);
      if (fallbackOrder) orderId = fallbackOrder.id;
    }

    if (!verification.success) {
      logger.warn(`Verification failed for ref ${reference}`);
      return res.redirect(`${frontendUrl}/payment-failed${orderId ? `?orderId=${orderId}` : ""}`);
    }

    if (orderId) {
      const order = await getOrderService(orderId);
      if (order) {
        await ensureDeliveryForOrder(order);
      } else {
        logger.warn(`Payment verified but order record not found for id ${orderId}`);
      }
    }

    return res.redirect(
      `${frontendUrl}/payment-success${orderId ? `?orderId=${orderId}&reference=${reference}` : `?reference=${reference}`}`
    );
  } catch (err) {
    logger.error(`Paystack callback error: ${err.message}`);
    return res.redirect(`${frontendUrl}/payment-failed`);
  }
};

// 3️⃣ Verify Payment
const verifyOrder = async (req, res, next) => {
  const { reference } = req.params;
  if (!reference) return res.status(400).json({ success: false, message: "Reference required" });

  try {
    const verification = await verifyOrderService(reference);
    const frontendUrl = process.env.FRONTEND_URL;

    let orderId = verification?.orderId;

    if (!orderId) {
      const fallbackOrder = await findOrderByReference(reference);
      if (fallbackOrder) orderId = fallbackOrder.id;
    }

    if (verification.success && orderId) {
      const order = await getOrderService(orderId);
      if (order) await ensureDeliveryForOrder(order);

      return res.json({
        success: true,
        orderId,
        message: "Payment verified successfully.",
        redirectUrl: `${frontendUrl}/payment-success${orderId ? `?orderId=${orderId}` : ""}`,
      });
    } else {
      return res.status(400).json({
        success: false,
        orderId,
        message: "Payment verification failed.",
        redirectUrl: `${frontendUrl}/payment-failed${orderId ? `?orderId=${orderId}` : ""}`,
      });
    }
  } catch (err) {
    logger.error(`Payment verification failed: ${err.message}`);
    next(err);
  }
};

// 4️⃣ Paystack Webhook
const paystackWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto.createHmac("sha512", secret).update(JSON.stringify(req.body)).digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      logger.warn("Invalid Paystack signature");
      return res.status(401).json({ success: false, message: "Invalid signature" });
    }

    const event = req.body;
    let orderId = event.data?.metadata?.orderId;

    if (!orderId) {
      const reference = event.data?.reference;
      if (reference) {
        const fallbackOrder = await findOrderByReference(reference);
        if (fallbackOrder) orderId = fallbackOrder.id;
      }
    }

    if (!orderId) {
      logger.warn("Webhook received but missing orderId (and fallback failed)");
      return res.status(400).json({ success: false, message: "Missing orderId metadata" });
    }

    const order = await getOrderService(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Only ensure delivery, do NOT update status
    if (event.event === "charge.success") {
      await ensureDeliveryForOrder(order);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    logger.error(`Webhook error: ${err.message}`);
    res.status(500).json({ success: false });
  }
};

// 5️⃣ User Orders
const listUserOrders = async (req, res, next) => {
  try {
    const orders = await getUserOrdersService(req.user.id);
    res.json({ success: true, orders });
  } catch (err) {
    logger.error(`Failed to fetch orders for user ${req.user.id}: ${err.message}`);
    next(err);
  }
};

// 6️⃣ Get Single Order
const getOrder = async (req, res, next) => {
  try {
    const order = await getOrderService(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (req.user.role !== "admin" && order.user_id !== req.user.id)
      return res.status(403).json({ success: false, message: "Forbidden" });

    res.json({ success: true, order });
  } catch (err) {
    logger.error(`Failed to fetch order ${req.params.orderId}: ${err.message}`);
    next(err);
  }
};

// 7️⃣ Track Order
const trackOrder = async (req, res, next) => {
  try {
    const order = await getOrderService(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (req.user.role !== "admin" && order.user_id !== req.user.id)
      return res.status(403).json({ success: false, message: "Forbidden" });

    res.json({
      success: true,
      estimatedDelivery: order.estimated_delivery,
      isPremium: order.is_premium,
    });
  } catch (err) {
    next(err);
  }
};

// 8️⃣ Admin Update Order Status — REMOVED

// 9️⃣ Admin List All Orders
const listAllOrders = async (_req, res, next) => {
  try {
    const orders = await listAllOrdersService();
    res.json({ success: true, orders });
  } catch (err) {
    logger.error(`Failed to fetch all orders: ${err.message}`);
    next(err);
  }
};

module.exports = {
  createOrder,
  paystackCallback,
  verifyOrder,
  paystackWebhook,
  listUserOrders,
  getOrder,
  trackOrder,
  listAllOrders,
};
