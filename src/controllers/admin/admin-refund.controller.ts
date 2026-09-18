import { Request, Response, NextFunction } from 'express';
import { Payment, PaymentType, PaymentStatus } from '../../models/payment.model.js';
import { Application } from '../../models/application.model.js';
import { AuditLog } from '../../models/audit-log.model.js';
import { sendSuccess } from '../../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { NotFoundError } from '../../utils/errors.js';

export class AdminRefundController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = parsePagination(req.query);

      const { count, rows } = await Payment.findAndCountAll({
        where: { type: PaymentType.REFUND },
        include: [
          { model: Application, as: 'application', attributes: ['id', 'name', 'slug'] },
          { model: Payment, as: 'originalPayment', attributes: ['id', 'reference'] },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      const formatted = rows.map((r: any) => ({
        id: r.id,
        paymentId: r.originalPaymentId || r.id,
        originalPaymentRef: r.originalPayment?.reference || r.reference,
        applicationId: r.applicationId,
        applicationName: r.application?.name || 'Default Application',
        amount: r.amount,
        currency: r.currency,
        reason: r.description || 'Administrative customer reversal request',
        status: r.status,
        requestedBy: (r.metadata as any)?.requestedBy || 'operations@reignova.com',
        approvedBy: (r.metadata as any)?.approvedBy || null,
        rejectionReason: r.failureReason || null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      const meta = buildPaginationMeta(page, limit, count);
      sendSuccess(res, formatted, 200, meta as unknown as Record<string, unknown>);
    } catch (err) {
      next(err);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refund = await Payment.findByPk(req.params.id as string);
      if (!refund) {
        throw new NotFoundError(`Refund record '${req.params.id}' not found`);
      }

      const actorEmail = req.adminUser ? req.adminUser.email : 'admin';
      refund.status = PaymentStatus.COMPLETED;
      refund.completedAt = new Date();
      refund.metadata = {
        ...(refund.metadata || {}),
        approvedBy: actorEmail,
        approvedAt: new Date().toISOString(),
      };
      await refund.save();

      try {
        await AuditLog.create({
          actor: req.adminUser ? `${req.adminUser.email} (${req.adminUser.role})` : 'admin',
          applicationId: refund.applicationId,
          resourceType: 'REFUND',
          resourceId: refund.id,
          action: 'REFUND_APPROVED',
          metadata: { amount: refund.amount, currency: refund.currency, reference: refund.reference },
          ipAddress: req.ip || req.socket.remoteAddress,
        });
      } catch {
        // non-blocking
      }

      sendSuccess(res, { success: true, refund }, 200);
    } catch (err) {
      next(err);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refund = await Payment.findByPk(req.params.id as string);
      if (!refund) {
        throw new NotFoundError(`Refund record '${req.params.id}' not found`);
      }

      const { reason = 'Dispute declined by compliance' } = req.body;
      const actorEmail = req.adminUser ? req.adminUser.email : 'admin';

      refund.status = PaymentStatus.FAILED;
      refund.failedAt = new Date();
      refund.failureReason = reason;
      refund.metadata = {
        ...(refund.metadata || {}),
        rejectedBy: actorEmail,
        rejectedAt: new Date().toISOString(),
      };
      await refund.save();

      try {
        await AuditLog.create({
          actor: req.adminUser ? `${req.adminUser.email} (${req.adminUser.role})` : 'admin',
          applicationId: refund.applicationId,
          resourceType: 'REFUND',
          resourceId: refund.id,
          action: 'REFUND_REJECTED',
          metadata: { reason, amount: refund.amount, reference: refund.reference },
          ipAddress: req.ip || req.socket.remoteAddress,
        });
      } catch {
        // non-blocking
      }

      sendSuccess(res, { success: true, refund }, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const adminRefundController = new AdminRefundController();
export default adminRefundController;
