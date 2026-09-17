import { Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service.js';
import { AuthenticatedRequest } from '../types/api.types.js';
import { sendSuccess } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { PaymentStatus } from '../models/payment.model.js';

export class PaymentController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
      const { response, statusCode, cached } = await paymentService.createDeposit(
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
      const payment = await paymentService.getPaymentById(
        req.params.id as string,
        req.application.id
      );
      sendSuccess(res, payment, 200);
    } catch (err) {
      next(err);
    }
  }

  async getByReference(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const payment = await paymentService.getPaymentByReference(
        req.params.reference as string,
        req.application.id
      );
      sendSuccess(res, payment, 200);
    } catch (err) {
      next(err);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const filters = {
        status: req.query.status as PaymentStatus | undefined,
        reference: req.query.reference as string | undefined,
        phoneNumber: req.query.phoneNumber as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };

      const { payments, total } = await paymentService.listPayments(
        req.application.id,
        filters,
        offset,
        limit
      );

      const meta = buildPaginationMeta(page, limit, total);
      sendSuccess(res, payments, 200, meta as unknown as Record<string, unknown>);
    } catch (err) {
      next(err);
    }
  }
}

export const paymentController = new PaymentController();
export default paymentController;
