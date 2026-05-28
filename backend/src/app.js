require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit  = require('express-rate-limit');
const pinoHttp   = require('pino-http');
const { v4: uuidv4 } = require('uuid');

const env         = require('./config/env');
const logger      = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

// ── Route modules ─────────────────────────────────────────────────────────────
const authRoutes        = require('./modules/auth/auth.routes');
const usersRoutes       = require('./modules/users/users.routes');
const projectsRoutes    = require('./modules/projects/projects.routes');
const allocationsRoutes = require('./modules/allocations/allocations.routes');
const timesheetsRoutes  = require('./modules/timesheets/timesheets.routes');
const exceptionsRoutes  = require('./modules/exceptions/exceptions.routes');
const dashboardRoutes   = require('./modules/dashboard/dashboard.routes');
const holidaysRoutes    = require('./modules/holidays/holidays.routes');
const reportsRoutes     = require('./modules/reports/reports.routes');
const skillsRoutes      = require('./modules/skills/skills.routes');

const app = express();

// ── Trust proxy ───────────────────────────────────────────────────────────────
// Required for correct req.ip behind Render / nginx / load balancers.
// Without this, rate limiters record the proxy IP, not the real client IP.
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:              ["'self'"],
      scriptSrc:               ["'self'"],
      styleSrc:                ["'self'"],
      imgSrc:                  ["'self'", 'data:'],
      connectSrc:              ["'self'"],
      objectSrc:               ["'none'"],
      frameAncestors:          ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

app.use(cors({
  origin:         env.CORS_ORIGIN,
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiters ─────────────────────────────────────────────────────────────
// NODE_ENV=test  → very high limits so JMeter load tests aren't throttled
// NODE_ENV=production → strict limits to protect against brute-force & DDoS
// NODE_ENV=development → relaxed limits for local dev

const isTest = env.NODE_ENV === 'test';
const isProd = env.NODE_ENV === 'production';

// Auth limiter — covers /login, /refresh, /logout
// Production: 10 attempts per minute per email/IP (stops brute-force)
// Test:       100,000 per minute (effectively unlimited for JMeter)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      isTest ? 100000 : isProd ? 10 : 100,
  message:  { success: false, message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders:   false,
  skipSuccessfulRequests: true, // successful logins don't count toward the limit
  keyGenerator: (req) => {
    // key by email for /login to prevent per-account brute-force
    // fall back to IP for /refresh and /logout
    if (req.path === '/login' && req.body?.email) {
      return req.body.email.toLowerCase();
    }
    return req.ip;
  },
});

// General limiter — applied to all /api/* routes
// Production: 200 req/min per IP
// Test:       1,000,000 per minute (effectively unlimited for JMeter 500 threads)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      isTest ? 1000000 : isProd ? 200 : 2000,
  standardHeaders: true,
  legacyHeaders:   false,
  skip: (req) => req.path === '/health', // never throttle health checks (used by load balancers)
});

// Apply general limiter to all API routes
app.use('/api', generalLimiter);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Correlation ID ────────────────────────────────────────────────────────────
// Threads a unique request ID through every log line for easy debugging
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ── HTTP request logging ──────────────────────────────────────────────────────
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.requestId,
  // Skip health check logs — they're noisy and useless in production logs
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
}));

// ── Swagger — development only ────────────────────────────────────────────────
// Never expose the full API schema in production (endpoint inventory = attack surface)
if (!isProd) {
  const swaggerUi   = require('swagger-ui-express');
  const swaggerSpec = require('./config/swagger');

  app.use('/api-docs', helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'cdn.jsdelivr.net'],
        styleSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
        imgSrc:     ["'self'", 'data:', 'cdn.jsdelivr.net'],
        connectSrc: ["'self'"],
      },
    },
  }), swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Resource Management API Docs',
    customCss: `
      .swagger-ui .topbar { background: #1e293b; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title { color: #1e293b; }
      .swagger-ui .scheme-container { background: #f8fafc; padding: 12px; border-radius: 8px; }
    `,
    swaggerOptions: {
      persistAuthorization:   true,
      displayRequestDuration: true,
      filter:       true,
      tryItOutEnabled: true,
    },
  }));

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  logger.info('Swagger UI available at /api-docs (non-production only)');
}

// ── Health check ──────────────────────────────────────────────────────────────
// Used by load balancers, Docker, and CI pipelines to verify liveness
app.get('/health', async (req, res) => {
  const prisma = require('./config/database');
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status:    'ok',
      db:        'connected',
      env:       env.NODE_ENV,
      uptime:    Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Never expose raw DB error — may contain connection string details
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
const API_PREFIX = '/api/v1';

// Auth gets the strict authLimiter on top of the general limiter
app.use(`${API_PREFIX}/auth`,        authLimiter, authRoutes);
app.use(`${API_PREFIX}/users`,       usersRoutes);
app.use(`${API_PREFIX}/projects`,    projectsRoutes);
app.use(`${API_PREFIX}/allocations`, allocationsRoutes);
app.use(`${API_PREFIX}/timesheets`,  timesheetsRoutes);
app.use(`${API_PREFIX}/exceptions`,  exceptionsRoutes);
app.use(`${API_PREFIX}/dashboard`,   dashboardRoutes);
app.use(`${API_PREFIX}/holidays`,    holidaysRoutes);
app.use(`${API_PREFIX}/reports`,     reportsRoutes);
app.use(`${API_PREFIX}/skills`,      skillsRoutes);

// 404 handler for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── React frontend — production only ─────────────────────────────────────────
const path = require('path');
const fs   = require('fs');
const frontendDist = path.join(__dirname, '../frontend-dist');

if (isProd && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, {
    maxAge: '1y',  // cache JS/CSS/images for 1 year (Vite uses content hashes)
    etag:   true,
  }));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
  });
}

// ── Global error handler — must be last ──────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Handles SIGTERM (Docker/Kubernetes stop) and SIGINT (Ctrl+C)
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);

  server.close(async () => {
    try {
      const prisma = require('./config/database');
      await prisma.$disconnect();
      logger.info('DB disconnected. Server closed cleanly.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  });

  // Force kill after 10s if shutdown hangs (e.g. long-running DB queries)
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Log unhandled rejections but don't crash (may be transient DB hiccups)
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

// Crash on uncaught exceptions — unknown state, safer to restart
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception — process will exit');
  process.exit(1);
});

module.exports = app;