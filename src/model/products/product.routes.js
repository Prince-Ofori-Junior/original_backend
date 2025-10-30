const express = require("express");
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  getCategories,
} = require("./product.controller");
const { protect } = require("../../middleware/authMiddleware");
const { authorizeRoles } = require("../../middleware/roleMiddleware");
const upload = require("../../utils/upload");
const rateLimit = require("express-rate-limit");
const { body, param, query, validationResult } = require("express-validator");

const router = express.Router();

// ------------------ Rate Limiting ------------------
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  message: { success: false, message: "Too many requests, please try again later." },
});
router.use(limiter);

// ------------------ Middleware ------------------
const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((v) => v.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ------------------ Products ------------------
// Admin: create product
router.post(
  "/",
  protect,
  authorizeRoles("admin"),
  upload.single("image"),
  validate([
    body("name").isString().trim().notEmpty(),
    body("description").optional().isString().trim(),
    body("price").isFloat({ min: 0 }),
    body("stock").isInt({ min: 0 }),
    body("category_id").isUUID(4),
  ]),
  createProduct
);

// Public: list products
router.get(
  "/",
  validate([
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("sortBy").optional().isString(),
    query("order").optional().isIn(["asc", "desc", "ASC", "DESC"]),
    query("category").optional().isUUID(4),
    query("search").optional().isString().trim(),
  ]),
  getProducts
);

// Public: get single product (with related products)
router.get("/:id", validate([param("id").isUUID(4)]), getProduct);

// Admin: update product
router.put(
  "/:id",
  protect,
  authorizeRoles("admin"),
  upload.single("image"),
  validate([
    param("id").isUUID(4),
    body("name").optional().isString().trim(),
    body("description").optional().isString().trim(),
    body("price").optional().isFloat({ min: 0 }),
    body("stock").optional().isInt({ min: 0 }),
    body("category_id").optional().isUUID(4),
  ]),
  updateProduct
);

// Admin: delete product
router.delete(
  "/:id",
  protect,
  authorizeRoles("admin"),
  validate([param("id").isUUID(4)]),
  deleteProduct
);

// ------------------ Categories ------------------
// Admin: create category
router.post(
  "/categories",
  protect,
  authorizeRoles("admin"),
  validate([body("name").isString().trim().notEmpty()]),
  createCategory
);

// Public: list categories
router.get("/categories/list", getCategories);

module.exports = router;
