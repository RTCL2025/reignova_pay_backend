import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';
import { authenticateApiKey } from '../middleware/authentication.middleware.js';
import { requireIdempotencyKey } from '../middleware/idempotency.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { createPaymentSchema, paymentFilterSchema } from '../schemas/payment.schema.js';
import { AuthenticatedRequest } from '../types/api.types.js';

export const paymentRoutes: Router = Router();

// All payment routes require valid application API key
paymentRoutes.use((req, res, next) => authenticateApiKey(req as AuthenticatedRequest, res, next));

paymentRoutes.post(
  '/',
  requireIdempotencyKey,
  validate({ body: createPaymentSchema }),
  (req, res, next) => paymentController.create(req as AuthenticatedRequest, res, next)
);

paymentRoutes.get(
  '/',
  validate({ query: paymentFilterSchema }),
  (req, res, next) => paymentController.list(req as AuthenticatedRequest, res, next)
);

paymentRoutes.get('/reference/:reference', (req, res, next) =>
  paymentController.getByReference(req as unknown as AuthenticatedRequest, res, next)
);

paymentRoutes.get('/:id', (req, res, next) =>
  paymentController.getById(req as unknown as AuthenticatedRequest, res, next)
);

export default paymentRoutes;
