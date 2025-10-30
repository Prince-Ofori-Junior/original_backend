// -------------------- IMPORTS --------------------
const dotenv = require("dotenv");
const http = require("http");
const process = require("process");
const { Server } = require("socket.io");
const app = require("./app");
const { connectDB, initializeDatabase, disconnectDB } = require("./config/db");
const logger = require("./config/logger");

// -------------------- LOAD ENVIRONMENT --------------------
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env";
dotenv.config({ path: envFile });

// -------------------- CHECK REQUIRED ENV VARIABLES --------------------
["DATABASE_URL", "JWT_SECRET", "COOKIE_SECRET"].forEach((key) => {
  if (!process.env[key]) {
    logger.error(`❌ Required environment variable ${key} not set in ${envFile}`);
    process.exit(1);
  }
});

const PORT = process.env.PORT || 8000;

// -------------------- ASYNC SERVER START --------------------
(async () => {
  try {
    // Connect to the database
    await connectDB();
    logger.info("✅ Database connected successfully");

    // Initialize database (migrations / seeders)
    await initializeDatabase();
    logger.info("✅ Database initialization completed");

    // Create HTTP server
    const server = http.createServer(app);

    // -------------------- SOCKET.IO --------------------
    // Use the same allowedOrigins array from app.js
const allowedSocketOrigins = process.env.FRONTEND_URL?.split(',') || [
  'https://original-frontend-theta.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://admin-beige-nu.vercel.app/login',

];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow server-to-server and dev tools
      if (allowedSocketOrigins.includes(origin)) return callback(null, true);
      logger.warn(`🚫 Blocked Socket.IO request from: ${origin}`);
      return callback(new Error('Not allowed by Socket.IO CORS'));
    },
    methods: ["GET", "POST", "PATCH"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

    // Make io instance available in controllers
    app.set("io", io);

    // Handle client connections
    io.on("connection", (socket) => {
      logger.info(`⚡ New client connected: ${socket.id}`);

      socket.on("join_room", (room) => {
        socket.join(room);
        logger.info(`Client ${socket.id} joined room: ${room}`);
      });

      socket.on("disconnect", (reason) => {
        logger.info(`Client disconnected: ${socket.id} (${reason})`);
      });
    });

    // -------------------- START SERVER --------------------
    server.listen(PORT, () => {
      logger.info(`🚀 Server running at http://localhost:${PORT} (${process.env.NODE_ENV || "development"})`);
    });

    // -------------------- GRACEFUL SHUTDOWN --------------------
    const shutdown = async (signal) => {
      try {
        logger.warn(`⚠️ Received ${signal}. Shutting down gracefully...`);
        server.close(async () => {
          logger.info("Server closed. Cleaning up resources...");
          if (disconnectDB) await disconnectDB();
          process.exit(0);
        });

        // Force exit after 10 seconds if not closed
        setTimeout(() => {
          logger.error("⚠️ Forced shutdown");
          process.exit(1);
        }, 10000);
      } catch (err) {
        logger.error("Error during shutdown:", err);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // -------------------- GLOBAL ERROR HANDLERS --------------------
    process.on("uncaughtException", (err) => {
      logger.error("💥 Uncaught Exception:", err);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error(`❌ Failed to start server: ${error.message}`, error);
    process.exit(1);
  }
})();
