// modules/reviews/review.controller.js
const {
  addReviewService,
  getReviewsService,
  updateReviewService,
  deleteReviewService,
} = require("./review.service");
const { validateReviewInput } = require("../../utils/validation");
const sanitize = require("sanitize-html");

// Add a review
const addReview = async (req, res, next) => {
  try {
    const { productId, rating, comment } = req.body;

    // Input validation
    validateReviewInput({ productId, rating, comment });

    // Sanitize input to prevent XSS
    const sanitizedComment = sanitize(comment);

    const review = await addReviewService(productId, req.user.id, rating, sanitizedComment);
    res.status(201).json({ success: true, review });
  } catch (err) {
    next(err);
  }
};

// Get reviews for a product
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!productId) throw new Error("Product ID is required");

    const reviews = await getReviewsService(productId);
    res.json({ success: true, reviews });
  } catch (err) {
    next(err);
  }
};

// Update a review
const updateReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const { reviewId } = req.params;

    if (!reviewId) throw new Error("Review ID is required");

    // Input validation
    validateReviewInput({ rating, comment }, { allowPartial: true });

    // Sanitize comment
    const sanitizedComment = comment ? sanitize(comment) : undefined;

    const updated = await updateReviewService(reviewId, req.user.id, rating, sanitizedComment);
    res.json({ success: true, review: updated });
  } catch (err) {
    next(err);
  }
};

// Delete a review
const deleteReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    if (!reviewId) throw new Error("Review ID is required");

    const deleted = await deleteReviewService(reviewId, req.user.id);
    res.json({ success: true, review: deleted });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addReview,
  getProductReviews,
  updateReview,
  deleteReview,
};
