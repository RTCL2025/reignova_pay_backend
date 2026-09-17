import { Request, Response, NextFunction } from 'express';
import { applicationService } from '../services/application.service.js';
import { sendSuccess } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';

export class ApplicationController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await applicationService.createApplication(
        req.body,
        'admin',
        req.ip
      );
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const app = await applicationService.getApplication(req.params.id as string);
      sendSuccess(res, app, 200);
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const { applications, total } = await applicationService.listApplications(offset, limit);
      const meta = buildPaginationMeta(page, limit, total);
      sendSuccess(res, applications, 200, meta as unknown as Record<string, unknown>);
    } catch (err) {
      next(err);
    }
  }

  async rotateKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await applicationService.rotateApiKey(
        req.params.id as string,
        'admin',
        req.ip
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  async suspend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await applicationService.suspendApplication(
        req.params.id as string,
        'admin',
        req.ip
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  async reactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await applicationService.reactivateApplication(
        req.params.id as string,
        'admin',
        req.ip
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const applicationController = new ApplicationController();
export default applicationController;
