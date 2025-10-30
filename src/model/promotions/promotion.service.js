// modules/promotions/promotion.service.js
const {
  createPromotion,
  updatePromotion,
  deletePromotion,
  getPromotionByCode,
  listPromotions,
} = require("./promotion.model");
const logger = require("../../config/logger");
const { validatePromoInput } = require("../../utils/validation");
const sanitize = require("sanitize-html"); // Prevent XSS in promotion fields

// Admin: create new promotion
const addPromotion = async (promotionData) => {
  // Validate input
  validatePromoInput(promotionData);

  // Sanitize inputs
  const sanitizedData = {
    code: sanitize(promotionData.code).toUpperCase(),
    discount: promotionData.discount,
    type: sanitize(promotionData.type),
    expiresAt: promotionData.expiresAt,
    usageLimit: promotionData.usageLimit,
  };

  const promo = await createPromotion(sanitizedData);
  logger.info(`Promotion created: ${promo.code}`);
  return promo;
};

// Admin: update promotion
const editPromotion = async (id, updates) => {
  if (!id) throw new Error("Promotion ID is required");

  const sanitizedUpdates = {};
  for (const key in updates) {
    if (updates[key] !== undefined) {
      sanitizedUpdates[key] = typeof updates[key] === "string" ? sanitize(updates[key]) : updates[key];
    }
  }

  const promo = await updatePromotion(id, sanitizedUpdates);
  if (!promo) throw new Error("Promotion not found or update failed");
  logger.info(`Promotion ${id} updated`);
  return promo;
};

// Admin: delete promotion
const removePromotion = async (id) => {
  if (!id) throw new Error("Promotion ID is required");

  const promo = await deletePromotion(id);
  if (!promo) throw new Error("Promotion not found or deletion failed");
  logger.info(`Promotion ${id} deleted`);
  return promo;
};

// Validate and fetch promotion
const validatePromotion = async (code) => {
  if (!code) throw new Error("Promotion code is required");

  const sanitizedCode = sanitize(code).toUpperCase();
  const promo = await getPromotionByCode(sanitizedCode);
  if (!promo) throw new Error("Invalid or expired promotion code");
  return promo;
};

// Admin: list all promotions
const getPromotions = async () => {
  const promos = await listPromotions();
  return promos;
};

module.exports = {
  addPromotion,
  editPromotion,
  removePromotion,
  validatePromotion,
  getPromotions,
};
