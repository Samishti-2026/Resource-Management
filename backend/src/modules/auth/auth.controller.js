const authService = require('./auth.service');
const { success, error, badRequest } = require('../../utils/apiResponse');

const loginController = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await authService.login(email, password, ipAddress);
    return success(res, result, 'Login successful');
  } catch (err) {
    if (err.message === 'Invalid credentials') {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    next(err);
  }
};

const refreshController = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    return success(res, result, 'Token refreshed');
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message });
  }
};

const logoutController = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    return success(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

const meController = async (req, res) => {
  return success(res, req.user, 'Current user');
};

module.exports = { loginController, refreshController, logoutController, meController };
