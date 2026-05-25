const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e) => {
  logger.error({ message: e.message }, 'Prisma error');
});

/*
|--------------------------------------------------------------------------
| Test Database Connection
|--------------------------------------------------------------------------
*/

async function connectDB() {
  try {
    await prisma.$connect();

    logger.info('✅ Azure PostgreSQL connected successfully');

    // Optional DB test query
    await prisma.$queryRaw`SELECT 1`;

    logger.info('✅ Database query test successful');
  } catch (error) {
    logger.error(
      {
        error: error.message,
      },
      '❌ Database connection failed'
    );

    process.exit(1);
  }
}

connectDB();

module.exports = prisma;