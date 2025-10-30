const {
  createOrderWithItems,
  getUserOrders,
  getOrderById,
  getAllOrders,
} = require("./order.model");

const axios = require("axios");
const logger = require("../../config/logger");
const { sendNotificationService } = require("../notification/notification.service");
const { pool } = require("../../config/db");
const {
  createDeliveryService,
  getDeliveryByOrderService,
  getAvailableCourier,
} = require("../delivery/delivery.service");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://original-frontend-theta.vercel.app";

// ------------------- DELIVERY HELPER -------------------
const ensureDeliveryForOrder = async (order) => {
  if (!order) throw new Error("Order is required to create delivery");

  // Check if delivery exists; auto-create if missing
  let delivery = await getDeliveryByOrderService(order.id, true);
  if (!delivery) {
    const courier = await getAvailableCourier();
    delivery = await createDeliveryService(order.id, order.address || "No address provided", courier);
    logger.info(`📦 Delivery auto-created for order ${order.id} with courier ${courier}`);
  }

  return delivery;
};

// ------------------- PLACE ORDER -------------------
const placeOrderService = async (userId, orderData) => {
  const {
    items,
    totalAmount,
    paymentMethod,
    paymentChannel,
    email,
    address,
    phone,
    is_premium,
    estimated_delivery,
  } = orderData;

  if (!Array.isArray(items) || items.length === 0) throw new Error("Order must have at least one item");
  if (!totalAmount || totalAmount <= 0) throw new Error("Invalid total amount");

  const reference =
    paymentMethod !== "cod"
      ? `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      : null;

  // Create order with items (no status yet)
  const { order, items: addedItems } = await createOrderWithItems(
    {
      totalAmount,
      paymentMethod,
      paymentChannel,
      paymentReference: reference,
      address,
      is_premium,
      estimated_delivery,
    },
    items,
    userId
  );

  // Notify user about order placement
  try {
    await sendNotificationService({
      targeted_user: userId,
      type: "email",
      title:
        paymentMethod === "cod"
          ? "Order Placed (Cash on Delivery)"
          : "Order Placed - Pending Payment",
      message: `Your order #${order.id} has been placed successfully and is ${
        paymentMethod === "cod" ? "awaiting processing." : "pending payment verification."
      }`,
    });
  } catch (err) {
    logger.error(`Notification failed for order ${order.id}: ${err.message}`);
  }

  let delivery = null;
  // Auto-create delivery immediately for COD
  if (paymentMethod === "cod") {
    delivery = await ensureDeliveryForOrder(order);
  }

  let paymentData = null;

  // Initialize Paystack payment for card/momo
  if (paymentMethod === "card" || paymentMethod === "momo") {
    try {
      const payload = {
        email: email || "customer@example.com",
        amount: Math.round(totalAmount * 100),
        currency: "GHS",
        reference,
        metadata: { orderId: order.id, userId, paymentMethod },
        callback_url: `${FRONTEND_URL}/order-success`,
        channels: paymentMethod === "card" ? ["card"] : ["mobile_money"],
      };

      if (paymentMethod === "momo") {
        payload.mobile_money = { phone, provider: paymentChannel };
      }

      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        payload,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" } }
      );

      const paystackData = response.data?.data;
      paymentData = {
        authorization_url: paystackData.authorization_url,
        access_code: paystackData.access_code,
        reference: paystackData.reference,
        orderId: order.id,
        amount: totalAmount,
        paymentChannel,
      };

      logger.info(`Paystack transaction initialized for order ${order.id}`);
    } catch (err) {
      logger.error("Paystack initialization failed: " + err.message);
      throw new Error("Failed to initialize payment with Paystack");
    }
  }

  return { order, paymentData, delivery };
};

// ------------------- VERIFY ORDER -------------------
const verifyOrderService = async (reference) => {
  const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  });

  const data = response.data;
  if (!data.status) return { success: false, message: "Payment verification failed." };

  const paystackData = data.data;
  const orderId = paystackData.metadata?.orderId;

  // Auto-create delivery after successful payment
  if (paystackData.status === "success" && orderId) {
    const order = await getOrderById(orderId);
    if (order) {
      await ensureDeliveryForOrder(order);
    }
  }

  return { success: paystackData.status === "success", orderId, paystackData };
};

// ------------------- EXPORT -------------------
module.exports = {
  placeOrderService, 
  getUserOrdersService: getUserOrders,
  getOrderService: getOrderById,
  listAllOrdersService: getAllOrders,
  verifyOrderService,
  ensureDeliveryForOrder, // Exported for direct use in controllers
};
