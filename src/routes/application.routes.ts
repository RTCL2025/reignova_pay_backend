import { Router } from 'express';
import { applicationController } from '../controllers/application.controller.js';
import { adminAuthMiddleware } from '../middleware/admin-auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { createApplicationSchema } from '../schemas/application.schema.js';

export const applicationRoutes: Router = Router();

// All admin routes require admin authentication
applicationRoutes.use(adminAuthMiddleware);

applicationRoutes.post(
  '/',
  validate({ body: createApplicationSchema }),
  (req, res, next) => applicationController.create(req, res, next)
);

applicationRoutes.get('/', (req, res, next) => applicationController.list(req, res, next));
applicationRoutes.get('/:id', (req, res, next) => applicationController.getById(req, res, next));
applicationRoutes.post('/:id/rotate-key', (req, res, next) =>
  applicationController.rotateKey(req, res, next)
);
applicationRoutes.post('/:id/suspend', (req, res, next) =>
  applicationController.suspend(req, res, next)
);
applicationRoutes.post('/:id/reactivate', (req, res, next) =>
  applicationController.reactivate(req, res, next)
);

export default applicationRoutes;
