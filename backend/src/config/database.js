const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

// Prisma 6 reads DATABASE_URL from environment automatically
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e) => {
  logger.error({ message: e.message }, 'Prisma error');
});

module.exports = prisma;
