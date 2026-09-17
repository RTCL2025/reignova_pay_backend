import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { healthRoutes } from './health.routes.js';
import { paymentRoutes } from './payment.routes.js';
import { webhookRoutes } from './webhook.routes.js';
import { applicationRoutes } from './application.routes.js';
import {
  publicRateLimiter,
  authenticatedRateLimiter,
  webhookRateLimiter
} from '../middleware/rate-limit.middleware.js';

export const routes: Router = Router();

// Unversioned health check routes
routes.use('/health', healthRoutes);

// OpenAPI Swagger UI Documentation
try {
  const openapiPath = path.resolve(process.cwd(), 'docs', 'openapi.yaml');
  if (fs.existsSync(openapiPath)) {
    const file = fs.readFileSync(openapiPath, 'utf8');
    const swaggerDocument = yaml.parse(file);
    routes.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }
} catch {
  // Gracefully continue if documentation cannot be loaded
}

// Version 1 API Routes
const apiV1 = Router();

// Admin applications management
apiV1.use('/admin/applications', publicRateLimiter, applicationRoutes);

// Payments management
apiV1.use('/payments', authenticatedRateLimiter, paymentRoutes);

// Incoming Webhooks
apiV1.use('/webhooks', webhookRateLimiter, webhookRoutes);

// Mount /api/v1
routes.use('/api/v1', apiV1);

export default routes;
