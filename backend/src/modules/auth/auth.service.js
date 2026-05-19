const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../../config/database');
const env = require('../../config/env');
const { logAudit } = require('../../services/auditService');

/**
 * Login user and return tokens
 */
async function login(email, password, ipAddress) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw new Error('Invalid credentials');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role.name,
    name: user.name,
  };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ id: user.id }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });

  // Store refresh token hash
  const tokenHash = await bcrypt.hash(refreshToken, 8);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await prisma.refreshToken.create({
    data: { tokenHash, userId: user.id, expiresAt },
  });

  await logAudit({
    userId: user.id,
    action: 'LOGIN',
    entityType: 'User',
    entityId: user.id,
    ipAddress,
  });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role.name },
  };
}

/**
 * Refresh access token
 */
async function refresh(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    const userId = decoded.id;

    // Verify token exists in DB
    const tokens = await prisma.refreshToken.findMany({
      where: { userId, expiresAt: { gte: new Date() } },
    });

    let isValid = false;
    for (const t of tokens) {
      if (await bcrypt.compare(refreshToken, t.tokenHash)) {
        isValid = true;
        break;
      }
    }

    if (!isValid) throw new Error('Invalid refresh token');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !user.isActive) throw new Error('User not found');

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      name: user.name,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
    return { accessToken };
  } catch (err) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Logout — invalidate refresh token
 */
async function logout(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    const tokens = await prisma.refreshToken.findMany({ where: { userId: decoded.id } });

    for (const t of tokens) {
      if (await bcrypt.compare(refreshToken, t.tokenHash)) {
        await prisma.refreshToken.delete({ where: { id: t.id } });
        break;
      }
    }
  } catch (err) {
    // Silent fail
  }
}

module.exports = { login, refresh, logout };
