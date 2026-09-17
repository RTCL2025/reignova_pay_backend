import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { errorHandlerMiddleware } from './middleware/error.middleware.js';
import { NotFoundError } from './utils/errors.js';
import { routes } from './routes/index.js';
import { registerPaymentProvider } from './services/payment.service.js';
import { pawapayService } from './integrations/pawapay/pawapay.service.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

// Register Pawapay as default payment provider
registerPaymentProvider(pawapayService);

export function createApp(): Express {
  const app = express();

  // Basic security & request identification
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Idempotency-Key',
        'X-Request-Id',
        'Admin-Api-Key',
        'Signature',
        'Signature-Input',
        'Content-Digest'
      ]
    })
  );
  app.use(requestIdMiddleware);

  // Structured HTTP logging (skip health checks to keep logs tidy)
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/health/ready'
      },
      genReqId: (req) => req.headers['x-request-id'] as string
    })
  );

  // Preserve rawBody for signature verification alongside parsed JSON
  app.use(
    express.json({
      limit: '100kb',
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      }
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Mount API & health routes
  app.use(routes);

  // 404 handler for unknown routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('Route', `${req.method} ${req.path}`));
  });

  // Global centralized error handler
  app.use(errorHandlerMiddleware);

  return app;
}

export const app = createApp();
export default app;
