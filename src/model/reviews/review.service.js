// modules/reviews/review.service.js
const {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  hasUserReviewed,
} = require("./review.model");
const logger = require("../../config/logger");
const { sanitizeInput } = require("../../utils/sanitize");

// ---------------- Add Review ----------------
const addReviewService = async (productId, userId, rating, comment) => {
  // Sanitize input to prevent XSS
  rating = parseInt(rating, 10);
  comment = sanitizeInput(comment);

  if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5");

  const existing = await hasUserReviewed(productId, userId);
  if (existing) {
    throw new Error("You have already reviewed this product");
  }

  const review = await createReview({ productId, userId, rating, comment });
  logger.info(`✅ Review ${review.id} created for product ${productId} by user ${userId}`);
  return review;
};

// ---------------- Get Reviews ----------------
const getReviewsService = async (productId) => {
  return await getProductReviews(productId);
};

// ---------------- Update Review ----------------
const updateReviewService = async (reviewId, userId, rating, comment, isAdmin = false) => {
  // Sanitize input
  rating = parseInt(rating, 10);
  comment = sanitizeInput(comment);

  if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5");

  // Fetch the review to check ownership
  const existingReview = await getProductReviews(reviewId);
  if (!existingReview) throw new Error("Review not found");

  if (!isAdmin && existingReview.user_id !== userId) {
    throw new Error("Unauthorized: cannot edit this review");
  }

  const updated = await updateReview(reviewId, { rating, comment });
  logger.info(`✏️ Review ${reviewId} updated by user ${userId}`);
  return updated;
};

// ---------------- Delete Review ----------------
const deleteReviewService = async (reviewId, userId, isAdmin = false) => {
  const existingReview = await getProductReviews(reviewId);
  if (!existingReview) throw new Error("Review not found");

  if (!isAdmin && existingReview.user_id !== userId) {
    throw new Error("Unauthorized: cannot delete this review");
  }

  const deleted = await deleteReview(reviewId);
  logger.info(`🗑️ Review ${reviewId} deleted by user ${userId}`);
  return deleted;
};

module.exports = {
  addReviewService,
  getReviewsService,
  updateReviewService,
  deleteReviewService,
};
