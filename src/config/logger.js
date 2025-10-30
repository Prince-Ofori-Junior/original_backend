/**
 * 🧠 Winston Logger Configuration (Enterprise-Grade)
 * ------------------------------------------------------------
 * ✨ Features:
 *  - Colorized & context-aware console logs
 *  - Daily rotate log files (error + combined)
 *  - Sensitive data masking (email, password, token)
 *  - Structured JSON-safe formatting
 *  - Automatic exception & rejection capture
 *  - Compatible with Morgan stream middleware
 *  - Graceful error handling for production safety
 * ------------------------------------------------------------
 */

const { createLogger, format, transports } = require("winston");
require("winston-daily-rotate-file");
const fs = require("fs");
const path = require("path");

// ------------------------------------------------------------
// 📁 Ensure log directory exists
// ------------------------------------------------------------
const LOG_DIR = path.join(__dirname, "../../logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ------------------------------------------------------------
// 🛡️ Sensitive Data Masking (emails, tokens, passwords)
// ------------------------------------------------------------
const maskSensitive = format((info) => {
  const mask = (val) => {
    if (!val || typeof val !== "string") return val;
    return val
      .replace(/("?(password|token|authorization)"?\s*:\s*")([^"]+)"/gi, '$1***"')
      .replace(/([A-Za-z0-9._%+-]{2})[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, "$1***$2")
      .replace(/\b([A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,})\b/g, "***");
  };

  const sanitize = (obj) => {
    if (Array.isArray(obj)) return obj.map(sanitize);
    if (obj && typeof obj === "object") {
      const clone = {};
      for (const key in obj) clone[key] = sanitize(obj[key]);
      return clone;
    }
    return mask(obj);
  };

  if (process.env.NODE_ENV === "production") {
    info.message = mask(info.message);
    info = sanitize(info);
  }

  return info;
});

// ------------------------------------------------------------
// 🎨 Custom Log Formatter (console + file)
// ------------------------------------------------------------
const logFormat = format.printf(({ timestamp, level, message, stack, ...meta }) => {
  const base = `${timestamp} [${level.toUpperCase()}]: ${message}`;
  const metaData = Object.keys(meta).length ? ` | Meta: ${JSON.stringify(meta)}` : "";
  const errorStack = stack ? `\n🧩 Stack: ${stack}` : "";
  return `${base}${metaData}${errorStack}`;
});

// ------------------------------------------------------------
// ⚙️ Create Logger
// ------------------------------------------------------------
const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  defaultMeta: {
    service: "Mr.Ofori_backend",
    env: process.env.NODE_ENV || "development",
  },
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.splat(),
    maskSensitive(),
    logFormat
  ),
  transports: [
    // 🖥️ Console Transport (colorized)
    new transports.Console({
      level: process.env.LOG_LEVEL || "debug",
      format: format.combine(
        format.colorize({ all: true }),
        format.timestamp({ format: "HH:mm:ss" }),
        format.align(),
        maskSensitive(),
        format.printf(({ timestamp, level, message }) => {
          return `${timestamp} | ${level}: ${message}`;
        })
      ),
    }),

    // 🧾 Error Log (rotates daily)
    new transports.DailyRotateFile({
      filename: path.join(LOG_DIR, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "30d",
      zippedArchive: true,
      handleExceptions: true,
      handleRejections: true,
    }),

    // 🗂️ Combined Log (all levels)
    new transports.DailyRotateFile({
      filename: path.join(LOG_DIR, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "info",
      maxSize: "50m",
      maxFiles: "30d",
      zippedArchive: true,
    }),
  ],
  exitOnError: false,
});

// ------------------------------------------------------------
// 🌍 Stream Support (for Morgan HTTP logging)
// ------------------------------------------------------------
logger.stream = {
  write: (message) => logger.info(message.trim()),
};

// ------------------------------------------------------------
// 🚨 Global Fail-safe Error Handlers
// ------------------------------------------------------------
process.on("uncaughtException", (err) => {
  logger.error("💥 Uncaught Exception", { message: err.message, stack: err.stack });
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("💥 Unhandled Promise Rejection", { reason, promise });
});

// ------------------------------------------------------------
// 🚀 Export Logger
// ------------------------------------------------------------
module.exports = logger;
