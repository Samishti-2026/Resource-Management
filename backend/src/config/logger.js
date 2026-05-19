const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

let transport;
if (isDev) {
  try {
    require.resolve('pino-pretty');
    transport = { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } };
  } catch {
    // pino-pretty not available, use default
  }
}

const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(transport ? { transport } : {}),
});

module.exports = logger;
