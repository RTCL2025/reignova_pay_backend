import { Request, Response, NextFunction } from 'express';
import { Checkout } from '../../models/checkout.model.js';
import { Application } from '../../models/application.model.js';
import { sendSuccess } from '../../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { NotFoundError } from '../../utils/errors.js';

export class AdminCheckoutController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = parsePagination(req.query);

      const { count, rows } = await Checkout.findAndCountAll({
        include: [
          { model: Application, as: 'application', attributes: ['id', 'name', 'slug'] },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      const formatted = rows.map((s: any) => {
        const firstAmount = Array.isArray(s.amounts) && s.amounts.length > 0 ? s.amounts[0] : null;
        return {
          id: s.id,
          applicationId: s.applicationId,
          applicationName: s.application?.name || 'Default Application',
          reference: s.reference,
          publicToken: s.publicToken,
          providerCheckoutId: s.providerCheckoutId,
          amount: firstAmount ? parseFloat(firstAmount.amount) : 0,
          currency: firstAmount ? firstAmount.currency : 'TZS',
          customerName: s.customerName,
          customerEmail: s.customerEmail,
          customerPhone: s.customerPhone,
          sessionStatus: s.status,
          paymentStatus: s.depositStatus || s.status,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
        };
      });

      const meta = buildPaginationMeta(page, limit, count);
      sendSuccess(res, formatted, 200, meta as unknown as Record<string, unknown>);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await Checkout.findByPk(req.params.id as string, {
        include: [
          { model: Application, as: 'application', attributes: ['id', 'name', 'slug'] },
        ],
      });

      if (!session) {
        throw new NotFoundError(`Checkout session '${req.params.id}' not found`);
      }

      sendSuccess(res, session, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const adminCheckoutController = new AdminCheckoutController();
export default adminCheckoutController;
