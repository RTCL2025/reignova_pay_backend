import { Router } from 'express';
import { payoutController } from '../controllers/payout.controller.js';
import { authenticateApiKey } from '../middleware/authentication.middleware.js';
import { requireIdempotencyKey } from '../middleware/idempotency.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { createPayoutSchema, payoutFilterSchema } from '../schemas/payout.schema.js';
import { AuthenticatedRequest } from '../types/api.types.js';

export const payoutRoutes: Router = Router();

payoutRoutes.use((req, res, next) => authenticateApiKey(req as AuthenticatedRequest, res, next));

payoutRoutes.post(
  '/',
  requireIdempotencyKey,
  validate({ body: createPayoutSchema }),
  (req, res, next) => payoutController.create(req as AuthenticatedRequest, res, next)
);

payoutRoutes.get(
  '/',
  validate({ query: payoutFilterSchema }),
  (req, res, next) => payoutController.list(req as AuthenticatedRequest, res, next)
);

payoutRoutes.get('/reference/:reference', (req, res, next) =>
  payoutController.getByReference(req as unknown as AuthenticatedRequest, res, next)
);

payoutRoutes.get('/:id', (req, res, next) =>
  payoutController.getById(req as unknown as AuthenticatedRequest, res, next)
);

export default payoutRoutes;
