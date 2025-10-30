const apiResponse = require("../../utils/apiResponse");
const {
  addProduct,
  listProducts,
  getSingleProduct,
  editProduct,
  removeProduct,
  addCategory,
  listCategories,
} = require("./product.service");
const Joi = require("joi");

// ------------------ Validation Schemas ------------------
const productSchema = Joi.object({
  name: Joi.string().max(255).required(),
  description: Joi.string().max(2000).optional(),
  price: Joi.number().positive().required(),
  stock: Joi.number().integer().min(0).required(),
  category_id: Joi.string().guid({ version: "uuidv4" }).required(),
  isActive: Joi.boolean().optional(),
});

const categorySchema = Joi.object({
  name: Joi.string().max(255).required(),
  description: Joi.string().allow("").optional(),
});

// ------------------ Products ------------------

// ✅ Admin: create product
const createProductController = async (req, res) => {
  try {
    const { error } = productSchema.validate(req.body);
    if (error) return apiResponse(res, 400, false, error.details[0].message);

    if (!req.file)
      return apiResponse(res, 400, false, "Product image is required");

    const data = await addProduct(req.body, req.file);

    // 🔊 WebSocket emit
    const io = req.app.get("io");
    io?.emit("productCreated", data);

    return apiResponse(res, 201, true, "Product created successfully", data);
  } catch (err) {
    console.error("❌ Error in createProductController:", err.message);
    return apiResponse(res, 500, false, "Failed to create product", {
      error: err.message,
    });
  }
};

// ✅ Public: list products
const getProductsController = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      order = "desc",
      category,
      search,
    } = req.query;

    const data = await listProducts({
      page,
      limit,
      sortBy,
      order,
      category,
      search,
    });

    return apiResponse(res, 200, true, "Products fetched successfully", {
      rows: data.rows,
      total: data.total,
    });
  } catch (err) {
    console.error("❌ Error in getProductsController:", err.message);
    return apiResponse(res, 500, false, "Failed to fetch products", {
      error: err.message,
    });
  }
};

// ✅ Public: get single product
const getProductController = async (req, res) => {
  try {
    const data = await getSingleProduct(req.params.id);
    if (!data) return apiResponse(res, 404, false, "Product not found");

    // Fix related products
    let related = [];
    if (data.category_id) {
      const allInCategory = await listProducts({ category: data.category_id, limit: 20 });
      related = (allInCategory.rows || [])
        .filter(p => String(p.id) !== String(data.id)) // exclude current product
        .map(p => ({ ...p, discountPrice: p.discount_price ?? null }));
    }

    // Attach related products
    const responseData = { ...data, discountPrice: data.discount_price ?? null, related };

    return apiResponse(res, 200, true, "Product fetched successfully", responseData);
  } catch (err) {
    console.error("❌ Error in getProductController:", err.message);
    return apiResponse(res, 500, false, "Failed to fetch product", {
      error: err.message,
    });
  }
};

// ✅ Admin: update product
const updateProductController = async (req, res) => {
  try {
    const { error } = productSchema.validate(req.body, { presence: "optional" });
    if (error) return apiResponse(res, 400, false, error.details[0].message);

    const data = await editProduct(req.params.id, req.body, req.file);

    // 🔊 WebSocket emit
    const io = req.app.get("io");
    io?.emit("productUpdated", data);

    return apiResponse(res, 200, true, "Product updated successfully", data);
  } catch (err) {
    console.error("❌ Error in updateProductController:", err.message);
    return apiResponse(res, 500, false, "Failed to update product", {
      error: err.message,
    });
  }
};

// ✅ Admin: soft-delete product
const deleteProductController = async (req, res) => {
  try {
    await removeProduct(req.params.id);

    // 🔊 WebSocket emit
    const io = req.app.get("io");
    io?.emit("productDeleted", { id: req.params.id });

    return apiResponse(res, 200, true, "Product deleted successfully");
  } catch (err) {
    console.error("❌ Error in deleteProductController:", err.message);
    return apiResponse(res, 500, false, "Failed to delete product", {
      error: err.message,
    });
  }
};

// ------------------ Categories ------------------

// ✅ Admin: create category
const createCategoryController = async (req, res) => {
  try {
    const { error } = categorySchema.validate(req.body);
    if (error) return apiResponse(res, 400, false, error.details[0].message);

    const data = await addCategory(req.body.name, req.body.description);
    return apiResponse(res, 201, true, "Category created successfully", data);
  } catch (err) {
    console.error("❌ Error in createCategoryController:", err.message);
    return apiResponse(res, 500, false, "Failed to create category", {
      error: err.message,
    });
  }
};

// ✅ Public: list categories
const getCategoriesController = async (_req, res) => {
  try {
    const data = await listCategories();
    return apiResponse(res, 200, true, "Categories fetched successfully", data);
  } catch (err) {
    console.error("❌ Error in getCategoriesController:", err.message);
    return apiResponse(res, 500, false, "Failed to fetch categories", {
      error: err.message,
    });
  }
};

module.exports = {
  createProduct: createProductController,
  getProducts: getProductsController,
  getProduct: getProductController,
  updateProduct: updateProductController,
  deleteProduct: deleteProductController,
  createCategory: createCategoryController,
  getCategories: getCategoriesController,
};
  