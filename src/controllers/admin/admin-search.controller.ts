import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { Application } from '../../models/application.model.js';
import { Payment, PaymentType } from '../../models/payment.model.js';
import { Checkout } from '../../models/checkout.model.js';
import { AuditLog } from '../../models/audit-log.model.js';
import { sendSuccess } from '../../utils/response.js';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Merchants' | 'Payments' | 'Refunds' | 'Payouts' | 'Checkout Sessions' | 'Audit Logs';
  href: string;
  badge?: string;
  metadata?: Record<string, unknown>;
}

export class AdminSearchController {
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const qStr = typeof req.query.q === 'string' ? req.query.q.trim() : '';

      if (!qStr) {
        // When query is empty, return empty result or top active merchants/payments
        sendSuccess(res, [], 200);
        return;
      }

      const q = `%${qStr}%`;

      const [applications, payments, refunds, payouts, checkouts, auditLogs] = await Promise.all([
        // 1. Applications (Merchants)
        Application.findAll({
          where: {
            [Op.or]: [
              { name: { [Op.iLike]: q } },
              { slug: { [Op.iLike]: q } },
              { description: { [Op.iLike]: q } },
              { id: { [Op.iLike]: q } },
            ],
          },
          limit: 5,
          order: [['updatedAt', 'DESC']],
        }),

        // 2. Payments (Deposits)
        Payment.findAll({
          where: {
            type: PaymentType.DEPOSIT,
            [Op.or]: [
              { reference: { [Op.iLike]: q } },
              { phoneNumber: { [Op.iLike]: q } },
              { description: { [Op.iLike]: q } },
              { providerPaymentId: { [Op.iLike]: q } },
              { id: { [Op.iLike]: q } },
            ],
          },
          include: [{ model: Application, as: 'application', attributes: ['name'] }],
          limit: 5,
          order: [['createdAt', 'DESC']],
        }),

        // 3. Refunds
        Payment.findAll({
          where: {
            type: PaymentType.REFUND,
            [Op.or]: [
              { reference: { [Op.iLike]: q } },
              { phoneNumber: { [Op.iLike]: q } },
              { description: { [Op.iLike]: q } },
              { id: { [Op.iLike]: q } },
            ],
          },
          include: [{ model: Application, as: 'application', attributes: ['name'] }],
          limit: 5,
          order: [['createdAt', 'DESC']],
        }),

        // 4. Payouts
        Payment.findAll({
          where: {
            type: PaymentType.PAYOUT,
            [Op.or]: [
              { reference: { [Op.iLike]: q } },
              { phoneNumber: { [Op.iLike]: q } },
              { description: { [Op.iLike]: q } },
              { id: { [Op.iLike]: q } },
            ],
          },
          include: [{ model: Application, as: 'application', attributes: ['name'] }],
          limit: 5,
          order: [['createdAt', 'DESC']],
        }),

        // 5. Checkout Sessions
        Checkout.findAll({
          where: {
            [Op.or]: [
              { reference: { [Op.iLike]: q } },
              { publicToken: { [Op.iLike]: q } },
              { customerEmail: { [Op.iLike]: q } },
              { customerPhone: { [Op.iLike]: q } },
              { id: { [Op.iLike]: q } },
            ],
          },
          include: [{ model: Application, as: 'application', attributes: ['name'] }],
          limit: 5,
          order: [['createdAt', 'DESC']],
        }),

        // 6. Audit Logs
        AuditLog.findAll({
          where: {
            [Op.or]: [
              { action: { [Op.iLike]: q } },
              { actor: { [Op.iLike]: q } },
              { resourceType: { [Op.iLike]: q } },
              { resourceId: { [Op.iLike]: q } },
            ],
          },
          limit: 5,
          order: [['createdAt', 'DESC']],
        }),
      ]);

      const results: SearchResultItem[] = [];

      // Format Applications
      applications.forEach((app: any) => {
        results.push({
          id: `merchant-${app.id}`,
          title: app.name,
          subtitle: `Merchant • ${app.slug}`,
          category: 'Merchants',
          href: `/admin/merchants/${app.id}`,
          badge: app.status || 'ACTIVE',
        });
      });

      // Format Payments
      payments.forEach((p: any) => {
        const appName = p.application?.name || 'Merchant';
        const formattedAmount = p.amount != null ? `${Number(p.amount).toLocaleString()} ${p.currency || 'TZS'}` : '';
        results.push({
          id: `payment-${p.id}`,
          title: `${p.reference}${formattedAmount ? ` (${formattedAmount})` : ''}`,
          subtitle: `${appName} • ${p.phoneNumber || 'Mobile'}`,
          category: 'Payments',
          href: `/admin/payments?ref=${encodeURIComponent(p.reference)}`,
          badge: p.status,
        });
      });

      // Format Refunds
      refunds.forEach((r: any) => {
        const appName = r.application?.name || 'Merchant';
        const formattedAmount = r.amount != null ? `${Number(r.amount).toLocaleString()} ${r.currency || 'TZS'}` : '';
        results.push({
          id: `refund-${r.id}`,
          title: `Refund ${r.reference}${formattedAmount ? ` (${formattedAmount})` : ''}`,
          subtitle: `${appName} • ${r.phoneNumber || 'Phone'}`,
          category: 'Refunds',
          href: `/admin/refunds?ref=${encodeURIComponent(r.reference)}`,
          badge: r.status,
        });
      });

      // Format Payouts
      payouts.forEach((po: any) => {
        const appName = po.application?.name || 'Merchant';
        const formattedAmount = po.amount != null ? `${Number(po.amount).toLocaleString()} ${po.currency || 'TZS'}` : '';
        results.push({
          id: `payout-${po.id}`,
          title: `Payout ${po.reference}${formattedAmount ? ` (${formattedAmount})` : ''}`,
          subtitle: `${appName} • ${po.phoneNumber || 'Recipient'}`,
          category: 'Payouts',
          href: `/admin/payouts?ref=${encodeURIComponent(po.reference)}`,
          badge: po.status,
        });
      });

      // Format Checkout Sessions
      checkouts.forEach((c: any) => {
        const appName = c.application?.name || 'Merchant';
        const contact = c.customerEmail || c.customerPhone || 'Session';
        results.push({
          id: `checkout-${c.id}`,
          title: `Checkout ${c.reference || c.publicToken?.substring(0, 12)}`,
          subtitle: `${appName} • ${contact}`,
          category: 'Checkout Sessions',
          href: `/admin/checkout-sessions?id=${c.id}`,
          badge: c.status,
        });
      });

      // Format Audit Logs
      auditLogs.forEach((a: any) => {
        results.push({
          id: `audit-${a.id}`,
          title: `Audit: ${a.action}`,
          subtitle: `By ${a.actor || 'System'} on ${a.resourceType || 'Resource'}`,
          category: 'Audit Logs',
          href: `/admin/audit-logs?search=${encodeURIComponent(a.action)}`,
          badge: a.resourceType,
        });
      });

      sendSuccess(res, results, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const adminSearchController = new AdminSearchController();
export default adminSearchController;
