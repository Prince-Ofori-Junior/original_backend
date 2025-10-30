require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const xssClean = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hsts = require('hsts');
const csurf = require('csurf');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger.json'); 
const logger = require('./config/logger');

// Redis & DB (safe import)
let redisClient;
try {
  redisClient = require('./config/redis'); // should export a ready client with .ping(), .get/.setEx
} catch (err) {
  logger.warn('Redis not configured/available - falling back to in-memory cache');
  redisClient = null;
}

const { pool } = require('./config/db');
const nodemailerTransporter = require('./config/mailer');
const path = require('path');

// -------------------- ROUTES --------------------
const authRoutes = require('./model/auth/auth.routes');
const productRoutes = require('./model/products/product.routes');
const orderRoutes = require('./model/orders/order.routes');
const reviewRoutes = require('./model/reviews/review.routes');
const adminRoutes = require('./model/admin/admin.routes');
const deliveryRoutes = require('./model/delivery/delivery.routes');
const notificationRoutes = require('./model/notification/notification.routes');
const wishlistRoutes = require('./model/wishlist/wishlist.routes');
const promotionRoutes = require('./model/promotions/promotion.routes');
const paymentRoutes = require('./routes/payment');
const checkoutRoutes = require('./routes/checkout');


// Advanced dashboard routes (make sure file exists: routes/adminDashboardRoutes.js or model/admin/dashboard.routes.js)
const adminDashboardRoutes = require('./routes/adminDashboard'); // CommonJS file we built earlier

const { errorHandler } = require('./middleware/errorMiddleware');

const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);

// -------------------- GLOBAL RATE LIMITER --------------------
// Apply a conservative global limiter to protect from abusive traffic.
// Increase window and max to fit real traffic patterns in production.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 150, // per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// -------------------- SECURITY MIDDLEWARE --------------------
app.use(
  helmet({
    // keep CSP but prefer a small allow-list; make sure any legit external domains are whitelisted in env
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'https:', 'data:'],
        connectSrc: ["'self'", 'wss:', 'https:'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
  })
);

// HSTS
app.use(hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));


// Additional headers
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking in frontends that don't need iframes
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// -------------------- CORS --------------------
const allowedOrigins = process.env.FRONTEND_URL?.split(',') || [
  'https://original-frontend-theta.vercel.app/',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://admin-beige-nu.vercel.app/login',
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // allow server-to-server and dev tools
      if (allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn(`🚫 Blocked CORS request from: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token',
    ],
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

// -------------------- GLOBAL MIDDLEWARE --------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(xssClean());
app.use(hpp());
app.use(cookieParser(process.env.COOKIE_SECRET || 'default_cookie_secret'));
app.use(compression());

// -------------------- CSRF --------------------
// Keep CSRF, but only apply to non-API unsafe routes (your design)
const csrfProtection = csurf({
  cookie: {
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax',
  },
});

// Expose token on request for frontends that need it
app.get('/csrf-token', csrfProtection, (req, res) => {
  res.status(200).json({ csrfToken: req.csrfToken() });
});

// Apply CSRF only to non-API unsafe routes
app.use((req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (req.path.startsWith('/api/') || safeMethods.includes(req.method)) {
    return next();
  }
  return csrfProtection(req, res, next);
});

// -------------------- STATIC FILES --------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// -------------------- LOGGING --------------------
if (process.env.NODE_ENV === 'production') {
  app.use(
    morgan('combined', {
      skip: (req) => req.url.includes('/api/docs') || req.url.includes('/health'),
      stream: { write: (message) => logger.info(message.trim()) },
    })
  );
} else {
  app.use(morgan('dev'));
}

// -------------------- ROUTES --------------------



// AUTH
app.use('/api/auth', authRoutes);

// ORDERS
app.use('/api/orders', orderRoutes);
app.use('/api/admin/orders', orderRoutes);

// REVIEWS
app.use('/api/reviews', reviewRoutes);

// WISHLIST
app.use('/api/wishlist', wishlistRoutes);

// ADMIN (users, dashboard, etc.)
app.use('/api/admin', adminRoutes);

// PRODUCTS (public + admin product features)
app.use('/api/products', productRoutes);
app.use('/api/admin/products', productRoutes); // ✅ FIXED — correct one

// DELIVERY
app.use('/api/delivery', deliveryRoutes);      // general delivery (create, track)
app.use('/api/admin/delivery', deliveryRoutes);
// NOTIFICATIONS
app.use('/api/notifications', notificationRoutes);

// PROMOTIONS
app.use('/api/promotions', promotionRoutes);

// PAYMENT + CHECKOUT
app.use('/api/payment', paymentRoutes);
app.use('/api/checkout', checkoutRoutes);

// Mount the admin dashboard routes (KPIs, sales-trends, user-growth, top-products, overview)
app.use('/api/admin/dashboard', adminDashboardRoutes);

// -------------------- TEST ROUTES --------------------
app.get('/hello', (_, res) => res.send('Hello from your backend!'));
app.get('/test', (_, res) => res.send('This is a test route!'));

// -------------------- SWAGGER --------------------
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// -------------------- HEALTH CHECKS --------------------
const healthAuth = (req, res, next) => {
  const token = req.headers['x-monitoring-token'];
  if (!token || token !== process.env.HEALTH_TOKEN) {
    logger.warn('Unauthorized health check attempt', { ip: req.ip, path: req.originalUrl });
    return res.status(403).json({
      status: 'forbidden',
      message: 'Unauthorized access to health endpoint',
    });
  }
  next();
};

app.get('/health/redis', healthAuth, async (req, res) => {
  if (!redisClient) {
    return res.status(503).json({ status: 'unavailable', message: 'Redis not configured' });
  }

  try {
    const ping = await Promise.race([
      redisClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000)),
    ]);
    res.status(ping === 'PONG' ? 200 : 503).json({
      status: ping === 'PONG' ? 'ok' : 'unhealthy',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Redis health check failed', { stack: err.stack });
    res.status(503).json({ status: 'error', message: 'Redis unreachable' });
  }
});

app.get('/health', healthAuth, async (req, res) => {
  const health = {
    redis: 'unknown',
    db: 'unknown',
    email: 'unknown',
    timestamp: new Date().toISOString(),
  };

  // Redis
  if (!redisClient) {
    health.redis = 'unconfigured';
  } else {
    try {
      const ping = await Promise.race([
        redisClient.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000)),
      ]);
      health.redis = ping === 'PONG' ? 'ok' : 'unhealthy';
    } catch {
      health.redis = 'unreachable';
    }
  }

  // DB
  try {
    await pool.query('SELECT 1');
    health.db = 'ok';
  } catch {
    health.db = 'unreachable';
  }

  // Email
  try {
    await nodemailerTransporter.verify();
    health.email = 'ok';
  } catch {
    health.email = 'unreachable';
  }

  const allOk = ['ok'].every((v) => [health.redis, health.db, health.email].includes(v));
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'error', services: health });
});

// -------------------- ERROR HANDLING --------------------
app.use(errorHandler);

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot find ${req.originalUrl}`,
  });
});

// Disable x-powered-by
app.disable('x-powered-by');

module.exports = app;
   