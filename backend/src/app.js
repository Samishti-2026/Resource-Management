require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const { v4: uuidv4 } = require('uuid');

const env = require('./config/env');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

// Route modules
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

// ── Trust proxy — required for correct req.ip behind Azure / IIS / nginx ─────
// Without this, rate limiters and audit logs record the proxy IP, not the client IP.
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
// Apply strict CSP globally. Swagger UI (dev only) gets its own relaxed policy below.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'"],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  ["'self'"],
      objectSrc:   ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  // HSTS: 1 year, include subdomains
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Auth endpoints: strict limit shared across login, refresh, and logout
// const authLimiter = rateLimit({
//   windowMs: 60 * 1000, // 1 minute
//   max: 100000,
//   message: { success: false, message: 'Too many requests, please try again later' },
//   standardHeaders: true,
//   legacyHeaders: false,
  // Key by email (body) for login to prevent per-account brute-force,
  // fall back to IP for other auth routes
//   keyGenerator: (req) => {
//     if (req.path === '/login' && req.body?.email) {
//       return req.body.email.toLowerCase();
//     }
//     return req.ip;
//   },
// });

// General API rate limiter
// const generalLimiter = rateLimit({
//   windowMs: 60 * 1000,
//   max: 2000000,
//   standardHeaders: true,
//   legacyHeaders: false,
// });

//app.use(generalLimiter);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Correlation ID — thread a unique request ID through every log line ────────
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ── HTTP request logging ──────────────────────────────────────────────────────
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.requestId,
}));

// ── Swagger API Documentation — development only ──────────────────────────────
// Never expose the full API schema, endpoint inventory, or example credentials
// to unauthenticated users in production.
if (env.NODE_ENV !== 'production') {
  const swaggerUi   = require('swagger-ui-express');
  const swaggerSpec = require('./config/swagger');

  // Relaxed CSP for Swagger UI (inline scripts/styles required by swagger-ui-express)
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
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  }));

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  logger.info('Swagger UI available at /api-docs (development only)');
}

// ── Health check ──────────────────────────────────────────────────────────────
/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Server health check
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *       503:
 *         description: Database unreachable
 */
app.get('/health', async (req, res) => {
  const prisma = require('./config/database');
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status:    'ok',
      db:        'connected',
      uptime:    Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Do NOT expose the raw DB error — it may contain connection string details
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
const API_PREFIX = '/api/v1';

// Auth routes get the strict authLimiter (covers login, refresh, logout)
app.use(`${API_PREFIX}/auth`, authRoutes);
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

// ── Serve React frontend in production ────────────────────────────────────────
const path = require('path');
const fs   = require('fs');
const frontendDist = path.join(__dirname, '../frontend-dist');

if (env.NODE_ENV === 'production' && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
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

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

module.exports = app;
