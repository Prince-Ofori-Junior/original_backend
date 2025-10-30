// src/utils/sanitize.js
const xss = require("xss");
const DOMPurify = require("isomorphic-dompurify");

/**
 * Sanitize string input against XSS and injection
 * @param {string} value
 * @returns {string}
 */
function sanitizeString(value) {
  if (typeof value !== "string") return value;
  let clean = value.trim();

  // Basic XSS filter
  clean = xss(clean, {
    whiteList: {}, // remove all HTML tags
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "iframe", "style"],
  });

  // Secondary layer
  clean = DOMPurify.sanitize(clean, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

  return clean;
}

/**
 * Recursively sanitize all fields in an object
 * @param {object} obj
 * @returns {object}
 */
function sanitizeObject(obj) {
  if (typeof obj !== "object" || obj === null) return obj;

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === "object") {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

module.exports = {
  sanitizeString,
  sanitizeObject,
};
