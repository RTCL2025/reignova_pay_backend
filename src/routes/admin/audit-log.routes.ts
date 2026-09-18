import { Router } from 'express';
import { adminAuditLogController } from '../../controllers/admin/admin-audit-log.controller.js';
import { adminAuthMiddleware } from '../../middleware/admin-auth.middleware.js';

export const adminAuditLogRoutes: Router = Router();

adminAuditLogRoutes.use(adminAuthMiddleware);

adminAuditLogRoutes.get('/', (req, res, next) => adminAuditLogController.list(req, res, next));
adminAuditLogRoutes.get('/:id', (req, res, next) => adminAuditLogController.getById(req, res, next));

export default adminAuditLogRoutes;
