import pino from 'pino';
import { env } from './env.js';

const isDevelopment = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'req.headers["admin-api-key"]',
      'headers.authorization',
      'headers["x-api-key"]',
      'headers["admin-api-key"]',
      'apiKey',
      'api_key',
      'api_key_hash',
      'password',
      'token',
      'PAWAPAY_API_TOKEN',
      'ADMIN_API_KEY',
      'API_KEY_PEPPER',
      'payer.accountDetails.phoneNumber',
      'accountDetails.phoneNumber'
    ],
    censor: '[REDACTED]'
  },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    : undefined
});

export default logger;
