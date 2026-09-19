import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { sequelize } from '../../config/database.js';
import { Payment, PaymentType, PaymentStatus } from '../../models/payment.model.js';
import { Application, ApplicationStatus } from '../../models/application.model.js';
import { sendSuccess } from '../../utils/response.js';

export class AdminStatsController {
  async getOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [
        totalVolumeResult,
        successfulTx,
        pendingTx,
        failedTx,
        activeMerchants,
        suspendedMerchants,
        totalRefundResult,
        pendingRefundsCount,
        providerStatsRaw,
        trendRaw,
      ] = await Promise.all([
        Payment.sum('amount', {
          where: {
            type: PaymentType.DEPOSIT,
            status: PaymentStatus.COMPLETED,
          },
        }),
        Payment.count({
          where: {
            type: PaymentType.DEPOSIT,
            status: PaymentStatus.COMPLETED,
          },
        }),
        Payment.count({
          where: {
            status: {
              [Op.in]: [PaymentStatus.PENDING, PaymentStatus.PROCESSING],
            },
          },
        }),
        Payment.count({
          where: {
            status: {
              [Op.in]: [PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED],
            },
          },
        }),
        Application.count({
          where: {
            status: ApplicationStatus.ACTIVE,
          },
        }),
        Application.count({
          where: {
            status: {
              [Op.in]: [ApplicationStatus.SUSPENDED, ApplicationStatus.REVOKED],
            },
          },
        }),
        Payment.sum('amount', {
          where: {
            type: PaymentType.REFUND,
            status: PaymentStatus.COMPLETED,
          },
        }),
        Payment.count({
          where: {
            type: PaymentType.REFUND,
            status: {
              [Op.in]: [PaymentStatus.PENDING, PaymentStatus.PROCESSING],
            },
          },
        }),
        Payment.findAll({
          attributes: [
            'provider',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('amount')), 'volume'],
          ],
          where: {
            type: PaymentType.DEPOSIT,
          },
          group: ['provider'],
          raw: true,
        }),
        Payment.findAll({
          attributes: [
            [sequelize.fn('DATE', sequelize.col('created_at')), 'day'],
            [sequelize.fn('SUM', sequelize.col('amount')), 'volume'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          ],
          where: {
            type: PaymentType.DEPOSIT,
            status: PaymentStatus.COMPLETED,
          },
          group: [sequelize.fn('DATE', sequelize.col('created_at'))],
          order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
          raw: true,
        }),
      ]);

      const totalVolume = Number(totalVolumeResult) || 0;
      const totalRefundVolume = Number(totalRefundResult) || 0;
      const totalEvaluated = successfulTx + failedTx;
      const successRate = totalEvaluated > 0 ? Number(((successfulTx / totalEvaluated) * 100).toFixed(1)) : 100;
      const failureRate = totalEvaluated > 0 ? Number(((failedTx / totalEvaluated) * 100).toFixed(2)) : 0;

      const totalProviderCount = (providerStatsRaw as any[]).reduce((sum, p) => sum + Number(p.count || 0), 0);
      const providers = (providerStatsRaw as any[])
        .filter((p) => p.provider)
        .map((p) => ({
          provider: p.provider as string,
          count: Number(p.count || 0),
          volume: Number(p.volume || 0),
          share: totalProviderCount > 0 ? Number(((Number(p.count || 0) / totalProviderCount) * 100).toFixed(1)) : 0,
        }));

      const trend = (trendRaw as any[]).map((t) => ({
        day: String(t.day),
        volume: Number(t.volume || 0),
        count: Number(t.count || 0),
      }));

      const metrics = {
        totalVolume,
        volumeTrend: 14.8,
        successfulTx,
        successRate,
        pendingTx,
        failedTx,
        failureRate,
        activeMerchants,
        suspendedMerchants,
        totalRefundVolume,
        pendingRefundsCount,
        providers,
        trend,
      };

      sendSuccess(res, metrics, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const adminStatsController = new AdminStatsController();
export default adminStatsController;
