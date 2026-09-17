import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { pawapayCallbackSchema } from '../schemas/webhook.schema.js';

export const webhookRoutes: Router = Router();

// Pawapay Webhook endpoint (no API key auth, uses signature verification)
webhookRoutes.post(
  '/pawapay',
  validate({ body: pawapayCallbackSchema }),
  (req, res, next) => webhookController.handlePawapay(req, res, next)
);

export default webhookRoutes;
