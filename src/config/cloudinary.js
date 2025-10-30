const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

// ------------------ CLOUDINARY CONFIG ------------------
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} catch (err) {
  logger.error(`❌ Cloudinary configuration failed: ${err.message}`, { stack: err.stack });
  throw new Error("CLOUDINARY_CONFIG_FAILED");
}

// ------------------ SECURITY SETTINGS ------------------
const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp"];
const MAX_FILE_SIZE_MB = 5;

// ------------------ HELPER: VALIDATE FILE ------------------
const validateFile = (filePath) => {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const stats = fs.statSync(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);

  if (!ALLOWED_FORMATS.includes(ext)) {
    throw new Error(`Invalid file type. Allowed formats: ${ALLOWED_FORMATS.join(", ")}`);
  }

  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(`File too large. Max allowed size: ${MAX_FILE_SIZE_MB}MB`);
  }
};

// ------------------ UPLOAD HELPER ------------------
const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    validateFile(filePath);

    const folder = options.folder || `uploads/${new Date().toISOString().split("T")[0]}`;
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      use_filename: true,
      unique_filename: true,
      resource_type: "image",
      ...options,
    });

    try {
      fs.unlinkSync(filePath);
    } catch (fsErr) {
      logger.warn(`Failed to delete local file ${filePath}: ${fsErr.message}`);
    }

    logger.info(`✅ Cloudinary upload successful: ${result.public_id}`);
    return result;
  } catch (err) {
    logger.error(`Cloudinary upload failed for ${filePath}: ${err.message}`, { stack: err.stack });
    throw new Error("IMAGE_UPLOAD_FAILED");
  }
};

// ------------------ DELETE HELPER ------------------
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) throw new Error("No public_id provided for deletion");
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
    logger.info(`🗑 Cloudinary image deleted: ${publicId}`);
  } catch (err) {
    logger.error(`Cloudinary delete failed for ${publicId}: ${err.message}`, { stack: err.stack });
    throw new Error("IMAGE_DELETE_FAILED");
  }
};

// ------------------ SIGNED URL GENERATOR ------------------
const generateSignedUrl = (publicId, options = {}) => {
  try {
    return cloudinary.url(publicId, { sign_url: true, ...options });
  } catch (err) {
    logger.error(`Generate signed URL failed for ${publicId}: ${err.message}`, { stack: err.stack });
    throw new Error("SIGNED_URL_GENERATION_FAILED");
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  generateSignedUrl,
};
