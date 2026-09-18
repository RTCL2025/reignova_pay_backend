import { Router } from 'express';
import { checkoutController } from '../controllers/checkout.controller.js';
import { authenticateApiKey } from '../middleware/authentication.middleware.js';
import { requireIdempotencyKey } from '../middleware/idempotency.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { createCheckoutSchema, checkoutFilterSchema } from '../schemas/checkout.schema.js';
import { AuthenticatedRequest } from '../types/api.types.js';

export const checkoutRoutes: Router = Router();

checkoutRoutes.use((req, res, next) => authenticateApiKey(req as AuthenticatedRequest, res, next));

checkoutRoutes.post(
  '/',
  requireIdempotencyKey,
  validate({ body: createCheckoutSchema }),
  (req, res, next) => checkoutController.create(req as AuthenticatedRequest, res, next)
);

checkoutRoutes.get(
  '/',
  validate({ query: checkoutFilterSchema }),
  (req, res, next) => checkoutController.list(req as AuthenticatedRequest, res, next)
);

checkoutRoutes.get('/code/:code', (req, res, next) =>
  checkoutController.getByCode(req as unknown as AuthenticatedRequest, res, next)
);

checkoutRoutes.get('/:id', (req, res, next) =>
  checkoutController.getById(req as unknown as AuthenticatedRequest, res, next)
);

checkoutRoutes.post('/:id/expire', (req, res, next) =>
  checkoutController.expire(req as unknown as AuthenticatedRequest, res, next)
);

export default checkoutRoutes;
