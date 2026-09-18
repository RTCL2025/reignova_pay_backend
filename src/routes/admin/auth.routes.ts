import { Router } from 'express';
import { adminAuthController } from '../../controllers/admin/admin-auth.controller.js';
import { adminAuthMiddleware } from '../../middleware/admin-auth.middleware.js';

export const adminAuthRoutes: Router = Router();

// Public administrative login endpoint
adminAuthRoutes.post('/login', (req, res, next) => adminAuthController.login(req, res, next));

// Authenticated me endpoint
adminAuthRoutes.get('/me', adminAuthMiddleware, (req, res, next) => adminAuthController.me(req, res, next));

export default adminAuthRoutes;
