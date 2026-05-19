const prisma = require('../config/database');
const logger = require('../config/logger');

/**
 * Log an audit event
 */
async function logAudit({ userId, action, entityType, entityId, oldValue = null, newValue = null, ipAddress = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValue,
        newValue,
        ipAddress,
      },
    });
  } catch (err) {
    // Audit failures should not break the main flow
    logger.error({ err }, 'Failed to write audit log');
  }
}

module.exports = { logAudit };
