const { forbidden } = require('../utils/apiResponse');

/**
 * RBAC middleware — pass allowed roles as arguments
 * Usage: authorize('RESOURCE_MANAGER', 'PROJECT_MANAGER')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return forbidden(res, 'Not authenticated');
    }
    if (!allowedRoles.includes(req.user.role)) {
      return forbidden(res, 'You do not have permission to perform this action');
    }
    next();
  };
};

module.exports = authorize;
