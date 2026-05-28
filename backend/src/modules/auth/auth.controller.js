const authService = require('./auth.service');
const { success } = require('../../utils/apiResponse');

/**
 * POST /auth/login
 * Returns accessToken + user in body.
 * Refresh token is set as an HttpOnly cookie by auth.service.login().
 */
const loginController = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    // trust proxy must be set so req.ip is the real client IP behind Render proxy
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const result = await authService.login(email, password, ipAddress, res);
    return success(res, result, 'Login successful');
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    next(err);
  }
};

/**
 * POST /auth/refresh
 * Reads refresh token from HttpOnly cookie.
 * Returns new accessToken in body; rotates refresh token cookie.
 */
const refreshController = async (req, res, next) => {
  try {
    // Prefer cookie (secure path); fall back to body for backwards-compat during migration
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }
    const result = await authService.refresh(refreshToken, res);
    return success(res, result, 'Token refreshed');
  } catch (err) {
    return res.status(err.statusCode || 401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

/**
 * POST /auth/logout
 * Clears the refresh token cookie and invalidates the DB record.
 */
const logoutController = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    await authService.logout(refreshToken, res);
    return success(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /auth/me
 * Returns the decoded JWT payload for the current user.
 */
const meController = async (req, res) => {
  return success(res, req.user, 'Current user');
};

module.exports = { loginController, refreshController, logoutController, meController };
