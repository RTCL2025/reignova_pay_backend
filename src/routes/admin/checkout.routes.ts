import { Router } from 'express';
import { adminCheckoutController } from '../../controllers/admin/admin-checkout.controller.js';
import { adminAuthMiddleware } from '../../middleware/admin-auth.middleware.js';

export const adminCheckoutRoutes: Router = Router();

adminCheckoutRoutes.use(adminAuthMiddleware);

adminCheckoutRoutes.get('/', (req, res, next) => adminCheckoutController.list(req, res, next));
adminCheckoutRoutes.get('/:id', (req, res, next) => adminCheckoutController.getById(req, res, next));

export default adminCheckoutRoutes;
