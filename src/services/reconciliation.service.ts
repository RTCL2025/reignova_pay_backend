import { Op } from 'sequelize';
import { paymentRepository, PaymentRepository } from '../repositories/payment.repository.js';
import { paymentService, PaymentService, getPaymentProvider } from './payment.service.js';
import { Payment, PaymentStatus } from '../models/payment.model.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

export class ReconciliationService {
  constructor(
    private readonly repo: PaymentRepository = paymentRepository,
    private readonly payments: PaymentService = paymentService
  ) {}

  /**
   * Reconciles a single payment against the active payment provider.
   */
  async reconcilePayment(paymentId: string): Promise<{
    reconciled: boolean;
    previousStatus: PaymentStatus;
    newStatus: PaymentStatus;
  }> {
    const payment = await this.repo.findByPk(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment', paymentId);
    }

    const previousStatus = payment.status;

    // Terminal states cannot be reconciled
    if (
      previousStatus === PaymentStatus.COMPLETED ||
      previousStatus === PaymentStatus.FAILED ||
      previousStatus === PaymentStatus.CANCELLED ||
      previousStatus === PaymentStatus.EXPIRED
    ) {
      return { reconciled: false, previousStatus, newStatus: previousStatus };
    }

    if (!payment.providerPaymentId) {
      logger.warn({ paymentId }, 'Cannot reconcile payment without providerPaymentId');
      return { reconciled: false, previousStatus, newStatus: previousStatus };
    }

    const provider = getPaymentProvider();
    const providerStatus = await provider.checkStatus(payment.providerPaymentId);

    if (providerStatus.status === 'UNKNOWN') {
      return { reconciled: false, previousStatus, newStatus: previousStatus };
    }

    let targetStatus: PaymentStatus | null = null;
    if (providerStatus.status === 'COMPLETED') {
      targetStatus = PaymentStatus.COMPLETED;
    } else if (providerStatus.status === 'FAILED') {
      targetStatus = PaymentStatus.FAILED;
    }

    if (targetStatus) {
      await this.payments.transitionStatus(
        payment,
        targetStatus,
        providerStatus.failureReason || 'Reconciled from provider status check',
        providerStatus.providerTransactionId
      );

      logger.info(
        { paymentId, from: previousStatus, to: targetStatus },
        'Payment reconciled with provider'
      );

      return { reconciled: true, previousStatus, newStatus: targetStatus };
    }

    return { reconciled: false, previousStatus, newStatus: previousStatus };
  }

  /**
   * Finds payments remaining in PROCESSING state longer than threshold.
   */
  async findStalePayments(hours = 2): Promise<Payment[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Payment.findAll({
      where: {
        status: PaymentStatus.PROCESSING,
        createdAt: {
          [Op.lte]: cutoff
        }
      }
    });
  }
}

export const reconciliationService = new ReconciliationService();
export default reconciliationService;
