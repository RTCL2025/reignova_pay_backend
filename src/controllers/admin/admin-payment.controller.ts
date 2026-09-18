import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { Payment } from '../../models/payment.model.js';
import { Application } from '../../models/application.model.js';
import { PaymentAttempt } from '../../models/payment-attempt.model.js';
import { AuditLog } from '../../models/audit-log.model.js';
import { sendSuccess } from '../../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { NotFoundError } from '../../utils/errors.js';

export class AdminPaymentController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const { status, applicationId, type, search } = req.query;

      const whereClause: any = {};

      if (status && status !== 'ALL') {
        whereClause.status = status;
      }

      if (applicationId && applicationId !== 'ALL') {
        whereClause.applicationId = applicationId;
      }

      if (type && type !== 'ALL') {
        whereClause.type = type;
      }

      if (search && typeof search === 'string' && search.trim()) {
        const q = `%${search.trim()}%`;
        whereClause[Op.or] = [
          { reference: { [Op.iLike]: q } },
          { id: { [Op.iLike]: q } },
          { phoneNumber: { [Op.iLike]: q } },
          { description: { [Op.iLike]: q } },
        ];
      }

      const { count, rows } = await Payment.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Application,
            as: 'application',
            attributes: ['id', 'name', 'slug'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      const formatted = rows.map((p: any) => ({
        id: p.id,
        applicationId: p.applicationId,
        applicationName: p.application?.name || 'Default Application',
        reference: p.reference,
        type: p.type,
        amount: p.amount,
        currency: p.currency,
        phoneNumber: p.phoneNumber,
        country: p.country,
        provider: p.provider,
        providerPaymentId: p.providerPaymentId,
        status: p.status,
        failureReason: p.failureReason,
        description: p.description,
        metadata: p.metadata,
        completedAt: p.completedAt,
        failedAt: p.failedAt,
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
      const payment = await Payment.findByPk(req.params.id as string, {
        include: [
          { model: Application, as: 'application', attributes: ['id', 'name', 'slug'] },
          { model: PaymentAttempt, as: 'attempts' },
        ],
      });

      if (!payment) {
        throw new NotFoundError(`Payment '${req.params.id}' not found`);
      }

      sendSuccess(res, payment, 200);
    } catch (err) {
      next(err);
    }
  }

  async retry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payment = await Payment.findByPk(req.params.id as string);
      if (!payment) {
        throw new NotFoundError(`Payment '${req.params.id}' not found`);
      }

      // Record administrative retry in audit logs
      try {
        await AuditLog.create({
          actor: req.adminUser ? `${req.adminUser.email} (${req.adminUser.role})` : 'admin',
          applicationId: payment.applicationId,
          resourceType: 'PAYMENT',
          resourceId: payment.id,
          action: 'PAYMENT_RETRY',
          metadata: { previousStatus: payment.status, reference: payment.reference },
          ipAddress: req.ip || req.socket.remoteAddress,
        });
      } catch {
        // non-blocking
      }

      sendSuccess(
        res,
        {
          id: payment.id,
          reference: payment.reference,
          message: `Payment retry instruction queued for reference ${payment.reference}`,
        },
        200
      );
    } catch (err) {
      next(err);
    }
  }
}

export const adminPaymentController = new AdminPaymentController();
export default adminPaymentController;
