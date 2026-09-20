import { Router } from 'express';
import { publicCheckoutController } from '../controllers/public-checkout.controller.js';

export const publicCheckoutRoutes: Router = Router();

publicCheckoutRoutes.get('/:publicToken', (req, res, next) =>
  publicCheckoutController.getSession(req, res, next)
);

publicCheckoutRoutes.post('/:publicToken/pay', (req, res, next) =>
  publicCheckoutController.initiatePayment(req, res, next)
);

publicCheckoutRoutes.get('/:publicToken/status', (req, res, next) =>
  publicCheckoutController.getStatus(req, res, next)
);

publicCheckoutRoutes.post('/:publicToken/cancel', (req, res, next) =>
  publicCheckoutController.cancelSession(req, res, next)
);

publicCheckoutRoutes.get('/:publicToken/receipt', (req, res, next) =>
  publicCheckoutController.getReceipt(req, res, next)
);

publicCheckoutRoutes.post('/:publicToken/simulate-approval', (req, res, next) =>
  publicCheckoutController.simulateApproval(req, res, next)
);

publicCheckoutRoutes.post('/:publicToken/simulate-timeout', (req, res, next) =>
  publicCheckoutController.simulateTimeout(req, res, next)
);

export default publicCheckoutRoutes;
