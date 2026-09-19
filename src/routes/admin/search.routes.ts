import { Router } from 'express';
import { adminSearchController } from '../../controllers/admin/admin-search.controller.js';
import { adminAuthMiddleware } from '../../middleware/admin-auth.middleware.js';

export const adminSearchRoutes: Router = Router();

adminSearchRoutes.use(adminAuthMiddleware);

adminSearchRoutes.get('/', (req, res, next) => adminSearchController.search(req, res, next));

export default adminSearchRoutes;
