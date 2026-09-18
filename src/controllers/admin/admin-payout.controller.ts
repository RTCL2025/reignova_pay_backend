import { Request, Response, NextFunction } from 'express';
import { Payment, PaymentType } from '../../models/payment.model.js';
import { Application } from '../../models/application.model.js';
import { sendSuccess } from '../../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { NotFoundError } from '../../utils/errors.js';

export class AdminPayoutController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = parsePagination(req.query);

      const { count, rows } = await Payment.findAndCountAll({
        where: { type: PaymentType.PAYOUT },
        include: [
          { model: Application, as: 'application', attributes: ['id', 'name', 'slug'] },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      const formatted = rows.map((p: any) => ({
        id: p.id,
        applicationId: p.applicationId,
        applicationName: p.application?.name || 'Default Application',
        recipientPhone: p.phoneNumber,
        recipientName: p.description || (p.metadata as any)?.recipientName || 'Beneficiary',
        amount: p.amount,
        currency: p.currency,
        provider: p.provider || 'PawaPay Corridor',
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

      const meta = buildPaginationMeta(page, limit, count);
      sendSuccess(res, formatted, 200, meta as unknown as Record<string, unknown>);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payout = await Payment.findOne({
        where: { id: req.params.id as string, type: PaymentType.PAYOUT },
        include: [
          { model: Application, as: 'application', attributes: ['id', 'name', 'slug'] },
        ],
      });

      if (!payout) {
        throw new NotFoundError(`Payout '${req.params.id}' not found`);
      }

      sendSuccess(res, payout, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const adminPayoutController = new AdminPayoutController();
export default adminPayoutController;
