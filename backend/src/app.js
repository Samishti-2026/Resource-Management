require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const env = require('./config/env');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

// Route modules
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const projectsRoutes = require('./modules/projects/projects.routes');
const allocationsRoutes = require('./modules/allocations/allocations.routes');
const timesheetsRoutes = require('./modules/timesheets/timesheets.routes');
const exceptionsRoutes = require('./modules/exceptions/exceptions.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const holidaysRoutes = require('./modules/holidays/holidays.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const skillsRoutes = require('./modules/skills/skills.routes');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'cdn.jsdelivr.net'],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(pinoHttp({ logger }));

// ── Swagger API Documentation ─────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
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

// Serve raw OpenAPI JSON spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health check
/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Server health check
 *     description: Returns server status and database connectivity. No authentication required.
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:    { type: string, example: ok }
 *                 db:        { type: string, example: connected }
 *                 timestamp: { type: string, format: date-time }
 *       503:
 *         description: Database unreachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: error }
 *                 db:     { type: string, example: disconnected }
 *                 error:  { type: string }
 */
app.get('/health', async (req, res) => {
  const prisma = require('./config/database');
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// API routes
const API_PREFIX = '/api/v1';
app.use(`${API_PREFIX}/auth`, authLimiter, authRoutes);
app.use(`${API_PREFIX}/users`, usersRoutes);
app.use(`${API_PREFIX}/projects`, projectsRoutes);
app.use(`${API_PREFIX}/allocations`, allocationsRoutes);
app.use(`${API_PREFIX}/timesheets`, timesheetsRoutes);
app.use(`${API_PREFIX}/exceptions`, exceptionsRoutes);
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
app.use(`${API_PREFIX}/holidays`, holidaysRoutes);
app.use(`${API_PREFIX}/reports`, reportsRoutes);
app.use(`${API_PREFIX}/skills`, skillsRoutes);

// 404 handler for API routes only
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// Serve React frontend in production
const path = require('path');
const fs = require('fs');
const frontendDist = path.join(__dirname, '../frontend-dist');

if (env.NODE_ENV === 'production' && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // All non-API routes serve React's index.html
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // In development or if frontend not built yet
  app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
  });
}

// Global error handler — must be last
app.use(errorHandler);

// Graceful shutdown
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
