require('dotenv').config();

const env = {
  DATABASE_URL:           process.env.DATABASE_URL,
  JWT_SECRET:             process.env.JWT_SECRET,
  JWT_REFRESH_SECRET:     process.env.JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN:         process.env.JWT_EXPIRES_IN         || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  PORT:                   parseInt(process.env.PORT || '3000', 10),
  NODE_ENV:               process.env.NODE_ENV               || 'development',
  CORS_ORIGIN:            process.env.CORS_ORIGIN            || 'http://localhost:5173',
  BCRYPT_ROUNDS:          parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
};

// ── Startup secret validation ─────────────────────────────────────────────────
// Known-weak values that must never reach production
const KNOWN_WEAK = [
  'fallback-secret-change-me',
  'fallback-refresh-secret-change-me',
  'resource-management-secret-jwt',
  'resource-management-secret-refresh',
  'secret',
  'changeme',
];

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of REQUIRED) {
  if (!env[key]) {
    throw new Error(`[env] Missing required environment variable: ${key}. Set it before starting the server.`);
  }
}

if (env.JWT_SECRET.length < 32 || env.JWT_REFRESH_SECRET.length < 32) {
  throw new Error('[env] JWT_SECRET and JWT_REFRESH_SECRET must each be at least 32 characters long.');
}

if (KNOWN_WEAK.includes(env.JWT_SECRET) || KNOWN_WEAK.includes(env.JWT_REFRESH_SECRET)) {
  if (env.NODE_ENV === 'production') {
    throw new Error('[env] Weak JWT secrets detected in production. Rotate them immediately.');
  } else {
    // eslint-disable-next-line no-console
    console.warn('\x1b[33m[env] WARNING: Weak JWT secrets in use. Never deploy these to production.\x1b[0m');
  }
}

module.exports = env;
