import pino from 'pino';
import { resolve } from 'path';

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      }
    : undefined,
});

export default logger;
