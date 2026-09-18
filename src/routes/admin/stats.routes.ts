import { Router } from 'express';
import { adminStatsController } from '../../controllers/admin/admin-stats.controller.js';
import { adminAuthMiddleware } from '../../middleware/admin-auth.middleware.js';

export const adminStatsRoutes: Router = Router();

adminStatsRoutes.use(adminAuthMiddleware);

adminStatsRoutes.get('/', (req, res, next) => adminStatsController.getOverview(req, res, next));

export default adminStatsRoutes;
