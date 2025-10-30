// utils/catchAsync.js
/**
 * Wraps async route handlers and forwards errors to centralized Express error handler
 * Also ensures unhandled promise rejections and thrown errors are caught safely
 */

module.exports = (fn) => {
  if (typeof fn !== "function") {
    throw new TypeError("catchAsync expects a function");
  }

  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      // Sanitize error before passing to error handler
      if (err && typeof err === "object") {
        const sanitizedError = { ...err };
        if (sanitizedError.stack) delete sanitizedError.stack; // prevent stack leak in production
        if (sanitizedError.sql) delete sanitizedError.sql;     // prevent DB query leak
        next(sanitizedError);
      } else {
        next(err);
      }
    });
  };
};
