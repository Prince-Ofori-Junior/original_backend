// utils/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const logger = require("../config/logger");

// Ensure upload directory exists
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Dynamic storage path per module (optional)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const baseDir = "uploads";
    const moduleDir = req.baseUrl.replace(/\//g, "_"); // e.g., /products -> _products
    const uploadPath = path.join(baseDir, moduleDir);
    ensureDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 12);
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = file.originalname
      .replace(ext, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_"); // sanitize file name
    cb(null, `${safeName}_${timestamp}_${randomStr}${ext}`);
  },
});

// File filter: allow images only & validate MIME and extension
const imageFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

  if (!allowedMimes.includes(file.mimetype) || !allowedExts.includes(ext)) {
    const err = new Error("Only image files (jpg, png, gif, webp) are allowed!");
    logger.warn(`File rejected: ${file.originalname} (${file.mimetype})`);
    return cb(err, false);
  }
  cb(null, true);
};

// Multer upload configuration
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

module.exports = upload;
