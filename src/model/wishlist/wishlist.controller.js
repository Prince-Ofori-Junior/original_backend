const {
  addProductToWishlist,
  removeProductFromWishlist,
  getWishlistForUser,
  listWishlists,
} = require("./wishlist.service");
const logger = require("../../config/logger");

/**
 * @desc Add a product to the user's wishlist
 * @route POST /api/wishlist
 * @access Private (User)
 */
const addWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    const item = await addProductToWishlist(req.user.id, productId);

    if (!item) {
      return res.status(409).json({ success: false, message: "Product already in wishlist" });
    }

    logger.info(`✅ User ${req.user.id} added product ${productId} to wishlist`);
    return res.status(201).json({
      success: true,
      message: "Product added to wishlist successfully",
      item,
    });
  } catch (err) {
    logger.error(`❌ Add wishlist failed for user ${req.user?.id || "N/A"}: ${err.message}`);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Failed to add product to wishlist",
    });
  }
};

/**
 * @desc Remove a product from the user's wishlist
 * @route DELETE /api/wishlist
 * @access Private (User)
 */
const removeWishlist = async (req, res) => {
  try {
    // Accept productId from query OR body
    const productId = req.query.productId || req.body.productId;
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    const item = await removeProductFromWishlist(req.user.id, productId);

    if (!item) {
      return res.status(404).json({ success: false, message: "Product not found in wishlist" });
    }

    logger.info(`🗑️ User ${req.user.id} removed product ${productId} from wishlist`);
    return res.json({
      success: true,
      message: "Product removed from wishlist successfully",
      item,
    });
  } catch (err) {
    logger.error(`❌ Remove wishlist failed for user ${req.user?.id || "N/A"}: ${err.message}`);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Failed to remove product from wishlist",
    });
  }
};

/**
 * @desc Get the wishlist of the logged-in user
 * @route GET /api/wishlist
 * @access Private (User)
 */
const getWishlist = async (req, res) => {
  try {
    const wishlist = await getWishlistForUser(req.user.id);
    return res.json({ success: true, message: "Wishlist fetched successfully", wishlist });
  } catch (err) {
    logger.error(`❌ Fetch wishlist failed for user ${req.user?.id || "N/A"}: ${err.message}`);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Failed to fetch wishlist",
    });
  }
};

/**
 * @desc Admin - Get all users' wishlists
 * @route GET /api/wishlist/all
 * @access Private (Admin)
 */
const listAllWishlist = async (_req, res) => {
  try {
    const wishlists = await listWishlists();
    return res.json({ success: true, message: "All wishlists fetched successfully", wishlists });
  } catch (err) {
    logger.error(`❌ Fetch all wishlists failed: ${err.message}`);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Failed to fetch all wishlists",
    });
  }
};

module.exports = {
  addWishlist,
  removeWishlist,
  getWishlist,
  listAllWishlist,
};
