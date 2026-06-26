import pino from 'pino';

const isProduction = process.env['NODE_ENV'] === 'production';

export const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  transport: isProduction ? undefined : {
    target: 'pino-pretty',
    options: { colorize: true },
  },
  base: {
    pid: false,
    hostname: false,
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

export function handleDatabaseError(error: any): never {
  if (error.code === '23505') {
    throw new Error('Record already exists');
  }
  if (error.code === '23503') {
    throw new Error('Foreign key constraint violation');
  }
  throw error;
}