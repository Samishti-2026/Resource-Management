const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/database');
const env = require('../../config/env');
const { logAudit } = require('../../services/auditService');

// Refresh token cookie lifetime in ms (must match JWT_REFRESH_EXPIRES_IN = 7d)
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cookie options for the refresh token.
 * HttpOnly  — not accessible via document.cookie / JS
 * Secure    — HTTPS only in production
 * SameSite  — prevents CSRF
 * Path      — scoped to auth routes only so it isn't sent on every request
 */
const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: REFRESH_TOKEN_TTL_MS,
  path: '/api/v1/auth',
};

/**
 * Login — returns accessToken + user in body; sets refreshToken as HttpOnly cookie.
 */
async function login(email, password, ipAddress, res) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  // Constant-time comparison: always run bcrypt even for missing/inactive users
  // to prevent timing-based user enumeration.
  const dummyHash = '$2a$12$invalidhashpaddingtomatchbcryptlength000000000000000000000';
  const passwordToCheck = user ? user.passwordHash : dummyHash;
  const isValid = await bcrypt.compare(password, passwordToCheck);

  if (!user || !user.isActive || !isValid) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const payload = {
    id:    user.id,
    email: user.email,
    role:  user.role.name,
    name:  user.name,
  };

  const accessToken  = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ id: user.id }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });

  // Store hashed refresh token in DB
  const tokenHash = await bcrypt.hash(refreshToken, 8);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await prisma.refreshToken.create({
    data: { tokenHash, userId: user.id, expiresAt },
  });

  // Set refresh token as HttpOnly cookie — never in response body
  res.cookie('refreshToken', refreshToken, refreshCookieOptions);

  await logAudit({
    userId:     user.id,
    action:     'LOGIN',
    entityType: 'User',
    entityId:   user.id,
    ipAddress,
  });

  // accessToken in body; refreshToken only in cookie
  return {
    accessToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role.name },
  };
}

/**
 * Refresh — reads token from HttpOnly cookie, rotates it, returns new accessToken.
 * Token rotation: old token is deleted, new token is issued and set as cookie.
 */
async function refresh(refreshToken, res) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }

  const userId = decoded.id;

  // Find all non-expired tokens for this user
  const tokens = await prisma.refreshToken.findMany({
    where: { userId, expiresAt: { gte: new Date() } },
  });

  // Find the matching token record
  let matchedToken = null;
  for (const t of tokens) {
    if (await bcrypt.compare(refreshToken, t.tokenHash)) {
      matchedToken = t;
      break;
    }
  }

  if (!matchedToken) {
    // Token not found — possible reuse of a rotated/stolen token.
    // Invalidate ALL sessions for this user as a security measure.
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await logAudit({
      userId,
      action:     'SUSPICIOUS_TOKEN_REUSE',
      entityType: 'User',
      entityId:   userId,
    });
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found or inactive'), { statusCode: 401 });
  }

  // ── Token rotation ────────────────────────────────────────────────────────
  // Delete the consumed token
  await prisma.refreshToken.delete({ where: { id: matchedToken.id } });

  // Issue a new refresh token
  const newRefreshToken = jwt.sign({ id: user.id }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
  const newHash    = await bcrypt.hash(newRefreshToken, 8);
  const expiresAt  = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await prisma.refreshToken.create({
    data: { tokenHash: newHash, userId: user.id, expiresAt },
  });

  // Set new refresh token cookie
  res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);

  const payload = {
    id:    user.id,
    email: user.email,
    role:  user.role.name,
    name:  user.name,
  };
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

  return { accessToken };
}

/**
 * Logout — deletes the refresh token from DB and clears the cookie.
 */
async function logout(refreshToken, res) {
  // Always clear the cookie regardless of token validity
  res.clearCookie('refreshToken', { ...refreshCookieOptions, maxAge: 0 });

  if (!refreshToken) return;

  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    const tokens  = await prisma.refreshToken.findMany({ where: { userId: decoded.id } });

    for (const t of tokens) {
      if (await bcrypt.compare(refreshToken, t.tokenHash)) {
        await prisma.refreshToken.delete({ where: { id: t.id } });
        break;
      }
    }
  } catch {
    // Token already expired or invalid — cookie is cleared above, nothing more to do
  }
}

module.exports = { login, refresh, logout, refreshCookieOptions };
