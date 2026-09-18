import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  pawapayCallbackSchema,
  pawapayPayoutCallbackSchema,
  pawapayRefundCallbackSchema,
  pawapayCheckoutCallbackSchema
} from '../schemas/webhook.schema.js';

export const webhookRoutes: Router = Router();

// Pawapay Deposit Callback (legacy and default deposit endpoint)
webhookRoutes.post(
  '/pawapay',
  validate({ body: pawapayCallbackSchema }),
  (req, res, next) => webhookController.handlePawapay(req, res, next)
);

// Pawapay Payout Callback
webhookRoutes.post(
  '/pawapay/payouts',
  validate({ body: pawapayPayoutCallbackSchema }),
  (req, res, next) => webhookController.handlePawapayPayout(req, res, next)
);

// Pawapay Refund Callback
webhookRoutes.post(
  '/pawapay/refunds',
  validate({ body: pawapayRefundCallbackSchema }),
  (req, res, next) => webhookController.handlePawapayRefund(req, res, next)
);

// Pawapay Checkout Callback
webhookRoutes.post(
  '/pawapay/checkouts',
  validate({ body: pawapayCheckoutCallbackSchema }),
  (req, res, next) => webhookController.handlePawapayCheckout(req, res, next)
);

export default webhookRoutes;

