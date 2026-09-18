import { Router } from 'express';
import { refundController } from '../controllers/refund.controller.js';
import { authenticateApiKey } from '../middleware/authentication.middleware.js';
import { requireIdempotencyKey } from '../middleware/idempotency.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { createRefundSchema, refundFilterSchema } from '../schemas/refund.schema.js';
import { AuthenticatedRequest } from '../types/api.types.js';

export const refundRoutes: Router = Router();

refundRoutes.use((req, res, next) => authenticateApiKey(req as AuthenticatedRequest, res, next));

refundRoutes.post(
  '/',
  requireIdempotencyKey,
  validate({ body: createRefundSchema }),
  (req, res, next) => refundController.create(req as AuthenticatedRequest, res, next)
);

refundRoutes.get(
  '/',
  validate({ query: refundFilterSchema }),
  (req, res, next) => refundController.list(req as AuthenticatedRequest, res, next)
);

refundRoutes.get('/reference/:reference', (req, res, next) =>
  refundController.getByReference(req as unknown as AuthenticatedRequest, res, next)
);

refundRoutes.get('/:id', (req, res, next) =>
  refundController.getById(req as unknown as AuthenticatedRequest, res, next)
);

export default refundRoutes;
