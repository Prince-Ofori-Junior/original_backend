const {
  addToWishlist,
  removeFromWishlist,
  getUserWishlist,
  listAllWishlists,
} = require("./wishlist.model");
const logger = require("../../config/logger");
const createError = require("http-errors");

/**
 * @desc Add a product to a user's wishlist
 * @param {string} userId - UUID
 * @param {string} productId - UUID
 * @returns {object|null} wishlist item or null if already exists
 */
const addProductToWishlist = async (userId, productId) => {
  if (!userId || !productId) throw createError(400, "User ID and Product ID are required");

  try {
    const item = await addToWishlist(userId, productId);

    // Return null if item already exists (controller handles 409)
    if (!item) return null;

    return mapWishlistItem(item);
  } catch (err) {
    logger.error(`❌ addProductToWishlist failed for user ${userId}: ${err.message}`);
    return Promise.reject(err.status ? err : createError(500, "Failed to add product to wishlist"));
  }
};

/**
 * @desc Remove a product from a user's wishlist
 * @param {string} userId - UUID
 * @param {string} productId - UUID
 * @returns {object|null} removed wishlist item or null if not found
 */
const removeProductFromWishlist = async (userId, productId) => {
  if (!userId || !productId) throw createError(400, "User ID and Product ID are required");

  try {
    const item = await removeFromWishlist(userId, productId);

    // Return null if item not found (controller handles 404)
    if (!item) return null;

    return mapWishlistItem(item);
  } catch (err) {
    logger.error(`❌ removeProductFromWishlist failed for user ${userId}: ${err.message}`);
    return Promise.reject(err.status ? err : createError(500, "Failed to remove product from wishlist"));
  }
};

/**
 * @desc Get all wishlist items for a user
 * @param {string} userId - UUID
 * @returns {array} user's wishlist
 */
const getWishlistForUser = async (userId) => {
  if (!userId) throw createError(400, "User ID is required");

  try {
    const items = await getUserWishlist(userId);
    return items.map(mapUserWishlistItem);
  } catch (err) {
    logger.error(`❌ getWishlistForUser failed for user ${userId}: ${err.message}`);
    return Promise.reject(createError(500, "Failed to fetch wishlist"));
  }
};

/**
 * @desc Admin: list all users' wishlists
 * @returns {array} all wishlists
 */
const listWishlists = async () => {
  try {
    const items = await listAllWishlists();
    return items.map(mapAdminWishlistItem);
  } catch (err) {
    logger.error(`❌ listWishlists failed: ${err.message}`);
    return Promise.reject(createError(500, "Failed to list all wishlists"));
  }
};

/** ----------------- Helper Mappers ----------------- */

const mapWishlistItem = (item) => ({
  id: item.id,
  product_id: item.product_id,
  name: item.name,
  price: item.price,
  discountPrice: item.discount_price ?? null,
  image_url: item.image_url,
  created_at: item.created_at,
});

const mapUserWishlistItem = (item) => ({
  id: item.wishlist_id,
  product_id: item.product_id,
  name: item.name,
  price: item.price,
  discountPrice: item.discount_price ?? null,
  image_url: item.image_url,
  created_at: item.created_at,
});

const mapAdminWishlistItem = (item) => ({
  id: item.wishlist_id,
  user_id: item.user_id,
  user_name: item.user_name,
  product_id: item.product_id,
  name: item.product_name,
  price: item.price,
  discountPrice: item.discount_price ?? null,
  image_url: item.image_url,
  created_at: item.created_at,
});

module.exports = {
  addProductToWishlist,
  removeProductFromWishlist,
  getWishlistForUser,
  listWishlists,
};
