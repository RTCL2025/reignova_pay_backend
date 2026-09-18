import { Router } from 'express';
import { adminRefundController } from '../../controllers/admin/admin-refund.controller.js';
import { adminAuthMiddleware } from '../../middleware/admin-auth.middleware.js';

export const adminRefundRoutes: Router = Router();

adminRefundRoutes.use(adminAuthMiddleware);

adminRefundRoutes.get('/', (req, res, next) => adminRefundController.list(req, res, next));
adminRefundRoutes.post('/:id/approve', (req, res, next) => adminRefundController.approve(req, res, next));
adminRefundRoutes.post('/:id/reject', (req, res, next) => adminRefundController.reject(req, res, next));

export default adminRefundRoutes;
