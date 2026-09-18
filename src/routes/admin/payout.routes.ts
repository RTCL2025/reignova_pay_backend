import { Router } from 'express';
import { adminPayoutController } from '../../controllers/admin/admin-payout.controller.js';
import { adminAuthMiddleware } from '../../middleware/admin-auth.middleware.js';

export const adminPayoutRoutes: Router = Router();

adminPayoutRoutes.use(adminAuthMiddleware);

adminPayoutRoutes.get('/', (req, res, next) => adminPayoutController.list(req, res, next));
adminPayoutRoutes.get('/:id', (req, res, next) => adminPayoutController.getById(req, res, next));

export default adminPayoutRoutes;
