import { Router } from 'express';
import { adminPaymentController } from '../../controllers/admin/admin-payment.controller.js';
import { adminAuthMiddleware } from '../../middleware/admin-auth.middleware.js';

export const adminPaymentRoutes: Router = Router();

adminPaymentRoutes.use(adminAuthMiddleware);

adminPaymentRoutes.get('/', (req, res, next) => adminPaymentController.list(req, res, next));
adminPaymentRoutes.get('/:id', (req, res, next) => adminPaymentController.getById(req, res, next));
adminPaymentRoutes.get('/:id/receipt', (req, res, next) => adminPaymentController.getReceipt(req, res, next));
adminPaymentRoutes.post('/:id/retry', (req, res, next) => adminPaymentController.retry(req, res, next));

export default adminPaymentRoutes;
