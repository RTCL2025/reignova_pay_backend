import { Response, NextFunction } from 'express';
import { checkoutService } from '../services/checkout.service.js';
import { AuthenticatedRequest } from '../types/api.types.js';
import { sendSuccess } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { CheckoutStatus } from '../models/checkout.model.js';

export class CheckoutController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
      const { response, statusCode, cached } = await checkoutService.createCheckout(
        req.application.id,
        req.body,
        idempotencyKey
      );

      if (cached) {
        res.setHeader('Idempotency-Replayed', 'true');
      }

      sendSuccess(res, response, statusCode);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const checkout = await checkoutService.getCheckoutById(
        req.params.id as string,
        req.application.id
      );
      sendSuccess(res, checkout, 200);
    } catch (err) {
      next(err);
    }
  }

  async getByCode(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const checkout = await checkoutService.getCheckoutByCode(
        req.params.code as string,
        req.application.id
      );
      sendSuccess(res, checkout, 200);
    } catch (err) {
      next(err);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const filters = {
        status: req.query.status as CheckoutStatus | undefined,
        reference: req.query.reference as string | undefined,
        checkoutCode: req.query.checkoutCode as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };

      const { checkouts, total } = await checkoutService.listCheckouts(
        req.application.id,
        filters,
        offset,
        limit
      );

      const meta = buildPaginationMeta(page, limit, total);
      sendSuccess(res, checkouts, 200, meta as unknown as Record<string, unknown>);
    } catch (err) {
      next(err);
    }
  }

  async expire(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const checkout = await checkoutService.expireCheckout(
        req.params.id as string,
        req.application.id
      );
      sendSuccess(res, checkout, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const checkoutController = new CheckoutController();
export default checkoutController;
