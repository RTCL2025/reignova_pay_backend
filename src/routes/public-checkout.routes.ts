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

// The simulate-approval and simulate-timeout routes were removed deliberately.
//
// They were mounted here unauthenticated, with no environment guard, so anyone
// holding a checkout link — which is handed to every payer — could POST to
// simulate-approval and drive their own checkout to COMPLETED without paying.
// That is a payment bypass, and the checkout link is not a secret.
//
// Provider behaviour is exercised against the pawaPay sandbox, which settles
// deposits for its published test MSISDNs, so nothing needs a bypass in the
// application itself.

export default publicCheckoutRoutes;
