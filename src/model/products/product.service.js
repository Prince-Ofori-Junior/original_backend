const fs = require("fs").promises;
const path = require("path");
const logger = require("../../config/logger");
const { uploadToCloudinary } = require("../../config/cloudinary");
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  createCategory,
  getCategories,
} = require("./product.model");

// Validate UUID (PostgreSQL IDs)
const isUuid = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

// ------------------ PRODUCTS ------------------
const addProduct = async (data, file) => {
  try {
    // Validation
    const { name, price, stock, category_id, description } = data;
    if (!name || !price || !stock || !category_id)
      throw new Error("Name, price, stock, and category_id are required");

    if (!isUuid(category_id))
      throw new Error("Valid category_id (UUID) is required");

    let imageUrl = null;

    // Handle Cloudinary upload
    if (file) {
      const uploaded = await uploadToCloudinary(file.path, {
        folder: "ecommerce/products",
      });
      imageUrl = uploaded.secure_url;

      // Clean up local file after upload
      await fs.unlink(file.path).catch(() => {});
    }

    const product = await createProduct({
      name: name.trim(),
      description: description?.trim() || "",
      price: parseFloat(price),
      stock: parseInt(stock),
      category_id,
      imageUrl,
    });

    logger.info(`✅ Product created: ${product.id} - ${product.name}`);
    return product;
  } catch (error) {
    logger.error(`❌ addProduct error: ${error.message}`);
    throw error;
  }
};

const editProduct = async (id, fields, file) => {
  try {
    const updateFields = {};

    if (fields.name) updateFields.name = fields.name.trim();
    if (fields.description) updateFields.description = fields.description.trim();
    if (fields.price !== undefined) updateFields.price = parseFloat(fields.price);
    if (fields.stock !== undefined) updateFields.stock = parseInt(fields.stock);

    if (fields.category_id) {
      if (!isUuid(fields.category_id))
        throw new Error("Valid category_id (UUID) is required");
      updateFields.category_id = fields.category_id;
    }

    if (file) {
      const uploaded = await uploadToCloudinary(file.path, {
        folder: "ecommerce/products",
      });
      updateFields.imageUrl = uploaded.secure_url;
      await fs.unlink(file.path).catch(() => {});
    }

    const updated = await updateProduct(id, updateFields);
    if (!updated) throw new Error("Product not found or update failed");

    logger.info(`✅ Product updated: ${id}`);
    return updated;
  } catch (error) {
    logger.error(`❌ editProduct error: ${error.message}`);
    throw error;
  }
};

const listProducts = async ({
  page = 1,
  limit = 20,
  sortBy = "created_at",
  order = "desc",
  category,
  search,
}) => {
  try {
    const safePage = Math.max(parseInt(page, 10), 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const safeOrder = order.trim().toUpperCase() === "ASC" ? "ASC" : "DESC";

    const result = await getProducts({
      page: safePage,
      limit: safeLimit,
      sortBy,
      order: safeOrder,
      category: category?.trim(),
      search: search?.trim(),
    });

    return result;
  } catch (error) {
    logger.error(`❌ listProducts error: ${error.message}`);
    throw error;
  }
};

const getSingleProduct = async (id) => {
  try {
    const product = await getProductById(id);
    if (!product) throw new Error("Product not found");

    // ------------------ Related Products ------------------
    let related = [];
    if (product.category_id) {
      const allInCategory = await getProducts({
        page: 1,
        limit: 20,
        category: product.category_id,
      });

      related = (allInCategory.rows || [])
        .filter(p => String(p.id) !== String(product.id)) // exclude current product
        .map(p => ({ ...p, discountPrice: p.discount_price ?? null }));
    }

    return { ...product, discountPrice: product.discount_price ?? null, related };
  } catch (error) {
    logger.error(`❌ getSingleProduct error: ${error.message}`);
    throw error;
  }
};

const removeProduct = async (id) => {
  try {
    const deleted = await deleteProduct(id);
    if (!deleted) throw new Error("Product not found");
    logger.warn(`🗑️ Product deleted: ${id}`);
    return deleted;
  } catch (error) {
    logger.error(`❌ removeProduct error: ${error.message}`);
    throw error;
  }
};

// ------------------ CATEGORIES ------------------
const addCategory = async (name, description = "") => {
  try {
    if (!name || !name.trim()) throw new Error("Category name is required");
    const category = await createCategory(name.trim(), description.trim());
    logger.info(`✅ Category created: ${category.id} - ${category.name}`);
    return category;
  } catch (error) {
    logger.error(`❌ addCategory error: ${error.message}`);
    throw error;
  }
};

const listCategories = async () => {
  try {
    return await getCategories();
  } catch (error) {
    logger.error(`❌ listCategories error: ${error.message}`);
    throw error;
  }
};

module.exports = {
  addProduct,
  listProducts,
  getSingleProduct,
  editProduct,
  removeProduct,
  addCategory,
  listCategories,
};
