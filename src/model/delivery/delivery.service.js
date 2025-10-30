const { 
  createDelivery,
  getOrCreateDelivery,
  updateDeliveryStatusByOrder,
  assignCourierByOrder,
  getAllDeliveries,
  getAllCouriers
} = require("./delivery.model");

const createError = require("http-errors");

// ✅ Default delivery statuses aligned with order lifecycle
const VALID_DELIVERY_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "completed",
  "cancelled",
  "failed",
  "returned",
  "refunded",
];

const DEFAULT_COURIER = "Default Courier";
const DEFAULT_STATUS = "pending";

// -------------------- CREATE DELIVERY (NO DUPLICATES) --------------------
const createDeliveryService = async (orderId, address, courier) => {
  if (!orderId || !address) throw createError(400, "Order ID and address are required");

  // Use atomic getOrCreateDelivery
  const delivery = await getOrCreateDelivery(orderId);
  if (delivery) return delivery;

  const newDelivery = await createDelivery({
    orderId,
    address,
    courier: courier || DEFAULT_COURIER,
    status: DEFAULT_STATUS,
  });

  if (!newDelivery) throw createError(500, "Failed to create delivery");
  return newDelivery;
};

// -------------------- GET DELIVERY BY ORDER --------------------
const getDeliveryByOrderService = async (orderId, autoCreate = false) => {
  let delivery = await getOrCreateDelivery(orderId);

  if (!delivery && autoCreate) {
    // Only create delivery if none exists
    delivery = await createDeliveryService(orderId, "No address provided", DEFAULT_COURIER);
  }

  if (!delivery && !autoCreate) throw createError(404, "Delivery not found for this order");

  return delivery;
};

// -------------------- UPDATE DELIVERY STATUS --------------------
const updateDeliveryStatusService = async (orderId, status) => {
  if (!VALID_DELIVERY_STATUSES.includes(status))
    throw createError(
      400,
      `Invalid delivery status. Allowed: ${VALID_DELIVERY_STATUSES.join(", ")}`
    );

  // Update delivery + order atomically
  const updatedDelivery = await updateDeliveryStatusByOrder(orderId, status);
  if (!updatedDelivery) throw createError(500, "Failed to update delivery status");

  return updatedDelivery;
};

// -------------------- ASSIGN COURIER BY ORDER --------------------
const assignCourierByOrderService = async (orderId, courier) => {
  if (!courier) throw createError(400, "Courier is required");

  const updatedDelivery = await assignCourierByOrder(orderId, courier);
  if (!updatedDelivery) throw createError(500, "Failed to assign courier");

  return updatedDelivery;
};

// -------------------- LIST ALL DELIVERIES --------------------
const listDeliveriesService = async () => {
  const deliveries = await getAllDeliveries();
  return deliveries || [];
};

// -------------------- GET ALL COURIERS --------------------
const getCouriersService = async () => {
  const couriers = await getAllCouriers();
  return couriers || [];
};

module.exports = {
  createDeliveryService,
  getDeliveryByOrderService,
  updateDeliveryStatusService,
  assignCourierByOrderService,
  listDeliveriesService,
  getCouriersService,
};
