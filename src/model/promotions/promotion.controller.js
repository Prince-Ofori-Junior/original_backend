// modules/promotions/promotion.controller.js
const catchAsync = require("../../utils/catchAsync");
const apiResponse = require("../../utils/apiResponse");
const {
  addPromotion,
  editPromotion,
  removePromotion,
  validatePromotion,
  getPromotions,
} = require("./promotion.service");

// ------------------ Admin: Create Promotion ------------------
const createPromo = catchAsync(async (req, res) => {
  const { code, description, discountType, discountValue, startDate, endDate, active } = req.body;

  if (!code || !discountType || discountValue == null || !startDate || !endDate) {
    return apiResponse(res, 400, false, "Missing required promotion fields");
  }

  const promo = await addPromotion({
    code: code.trim().toUpperCase(),
    description: description?.trim() || "",
    discountType,
    discountValue: parseFloat(discountValue),
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    active: active !== undefined ? !!active : true,
  });

  return apiResponse(res, 201, true, "Promotion created successfully", promo);
});

// ------------------ Admin: Update Promotion ------------------
const updatePromo = catchAsync(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return apiResponse(res, 400, false, "Invalid promotion ID");

  const fields = { ...req.body };
  if (fields.discountValue !== undefined) fields.discountValue = parseFloat(fields.discountValue);
  if (fields.startDate) fields.startDate = new Date(fields.startDate);
  if (fields.endDate) fields.endDate = new Date(fields.endDate);
  if (fields.active !== undefined) fields.active = !!fields.active;

  const promo = await editPromotion(id, fields);
  return apiResponse(res, 200, true, "Promotion updated successfully", promo);
});

// ------------------ Admin: Delete Promotion ------------------
const deletePromo = catchAsync(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return apiResponse(res, 400, false, "Invalid promotion ID");

  const promo = await removePromotion(id);
  return apiResponse(res, 200, true, "Promotion deleted successfully", promo);
});

// ------------------ Validate Promotion Code ------------------
const checkPromo = catchAsync(async (req, res) => {
  const { code } = req.query;
  if (!code) return apiResponse(res, 400, false, "Promotion code is required");

  const promo = await validatePromotion(code.trim().toUpperCase());
  return apiResponse(res, 200, true, "Promotion validated successfully", promo);
});

// ------------------ Admin: List All Promotions ------------------
const listAllPromos = catchAsync(async (_req, res) => {
  const promos = await getPromotions();
  return apiResponse(res, 200, true, "Promotions fetched successfully", promos);
});

module.exports = {
  createPromo,
  updatePromo,
  deletePromo,
  checkPromo,
  listAllPromos,
};
