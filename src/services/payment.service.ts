import { Transaction } from 'sequelize';
import { paymentRepository, PaymentRepository } from '../repositories/payment.repository.js';
import { idempotencyService, IdempotencyService } from './idempotency.service.js';
import { notificationService, NotificationService } from './notification.service.js';
import { Payment, PaymentStatus } from '../models/payment.model.js';
import { PaymentAttempt } from '../models/payment-attempt.model.js';
import {
  CreatePaymentDto,
  CreatePayoutDto,
  CreateRefundDto,
  PaymentFilters,
  PaymentResponse,
  PaymentType,
  isValidTransition
} from '../types/payment.types.js';
import { PaymentProvider } from '../types/provider.types.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  InvalidStateTransitionError,
  ProviderError
} from '../utils/errors.js';
import { logger } from '../config/logger.js';

let activeProvider: PaymentProvider | null = null;

export function registerPaymentProvider(provider: PaymentProvider): void {
  activeProvider = provider;
  logger.info({ providerName: provider.name }, 'Registered active payment provider');
}

export function getPaymentProvider(): PaymentProvider {
  if (!activeProvider) {
    throw new ProviderError('No payment provider configured', 'none', 500);
  }
  return activeProvider;
}

export class PaymentService {
  constructor(
    private readonly repo: PaymentRepository = paymentRepository,
    private readonly idempotency: IdempotencyService = idempotencyService,
    private readonly notification: NotificationService = notificationService
  ) {}

  public mapToResponse(payment: Payment): PaymentResponse {
    return {
      id: payment.id,
      applicationId: payment.applicationId,
      reference: payment.reference,
      type: payment.type,
      amount: payment.amount,
      currency: payment.currency,
      phoneNumber: payment.phoneNumber,
      country: payment.country,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      status: payment.status,
      failureReason: payment.failureReason,
      description: payment.description,
      metadata: payment.metadata,
      originalPaymentId: payment.originalPaymentId,
      customerMessage: payment.customerMessage,
      completedAt: payment.completedAt,
      failedAt: payment.failedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    };
  }


  async createDeposit(
    applicationId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
    providerOverride?: PaymentProvider
  ): Promise<{ response: PaymentResponse; statusCode: number; cached: boolean }> {
    const provider = providerOverride || getPaymentProvider();

    const idempotentExecution = await this.idempotency.executeWithIdempotency<PaymentResponse>(
      applicationId,
      idempotencyKey,
      dto,
      async () => {
        // Check duplicate reference for this application before initiating
        const existingPayment = await this.repo.findByReference(dto.reference, applicationId);
        if (existingPayment) {
          throw new ConflictError(
            `Payment with reference '${dto.reference}' already exists for this application`
          );
        }

        // Step 1: Create initial PENDING payment record
        const payment = await this.repo.create({
          applicationId,
          reference: dto.reference,
          amount: dto.amount,
          currency: dto.currency,
          phoneNumber: dto.phoneNumber,
          country: dto.country,
          provider: dto.provider || provider.name,
          status: PaymentStatus.PENDING,
          description: dto.description || null,
          metadata: dto.metadata || null
        });

        // Step 2: Record initial attempt
        const attempt = await PaymentAttempt.create({
          paymentId: payment.id,
          attemptNumber: 1,
          provider: provider.name,
          status: 'SUBMITTED',
          requestPayload: {
            amount: dto.amount,
            currency: dto.currency,
            country: dto.country,
            reference: dto.reference
          }
        });

        // Step 3: Call payment provider
        try {
          const providerResult = await provider.initiateDeposit({
            paymentId: payment.id,
            reference: dto.reference,
            amount: dto.amount,
            currency: dto.currency,
            phoneNumber: dto.phoneNumber,
            country: dto.country,
            provider: dto.provider,
            description: dto.description,
            metadata: dto.metadata
          });

          if (providerResult.status === 'ACCEPTED' || providerResult.status === 'DUPLICATE_IGNORED') {
            await this.repo.update(payment.id, {
              status: PaymentStatus.PROCESSING,
              providerPaymentId: providerResult.providerPaymentId
            });

            await attempt.update({
              status: 'ACCEPTED',
              providerRequestId: providerResult.providerPaymentId,
              responsePayload: (providerResult.rawResponse as Record<string, unknown>) || null
            });

            // Reload payment
            const updated = await this.repo.findById(payment.id, applicationId);
            const response = this.mapToResponse(updated!);

            // Dispatch notification in background
            await this.notification.createNotification(updated!, 'payment.processing');

            return {
              statusCode: 202, // Accepted for processing
              body: response,
              resourceId: payment.id
            };
          }

          // Provider rejected the deposit request
          await this.repo.update(payment.id, {
            status: PaymentStatus.FAILED,
            failureReason: providerResult.error?.message || 'Deposit rejected by provider',
            failedAt: new Date()
          });

          await attempt.update({
            status: 'REJECTED',
            errorCode: providerResult.error?.code,
            errorMessage: providerResult.error?.message,
            responsePayload: (providerResult.rawResponse as Record<string, unknown>) || null
          });

          const failed = await this.repo.findById(payment.id, applicationId);
          const response = this.mapToResponse(failed!);

          await this.notification.createNotification(failed!, 'payment.failed');

          return {
            statusCode: 422, // Unprocessable
            body: response,
            resourceId: payment.id
          };
        } catch (providerErr: unknown) {
          logger.error(
            { err: providerErr, paymentId: payment.id },
            'Payment provider invocation failed'
          );

          await attempt.update({
            status: 'ERROR',
            errorMessage: providerErr instanceof Error ? providerErr.message : String(providerErr)
          });

          throw new ProviderError(
            providerErr instanceof Error ? providerErr.message : 'Payment provider error',
            provider.name
          );
        }
      }
    );

    return {
      response: idempotentExecution.body,
      statusCode: idempotentExecution.statusCode,
      cached: idempotentExecution.cached
    };
  }

  async createPayout(
    applicationId: string,
    dto: CreatePayoutDto,
    idempotencyKey?: string,
    providerOverride?: PaymentProvider
  ): Promise<{ response: PaymentResponse; statusCode: number; cached: boolean }> {
    const provider = providerOverride || getPaymentProvider();

    const idempotentExecution = await this.idempotency.executeWithIdempotency<PaymentResponse>(
      applicationId,
      idempotencyKey,
      dto,
      async () => {
        const existingPayment = await this.repo.findByReference(dto.reference, applicationId);
        if (existingPayment) {
          throw new ConflictError(
            `Payment with reference '${dto.reference}' already exists for this application`
          );
        }

        const payment = await this.repo.create({
          applicationId,
          reference: dto.reference,
          type: PaymentType.PAYOUT,
          amount: dto.amount,
          currency: dto.currency,
          phoneNumber: dto.phoneNumber,
          country: dto.country,
          provider: dto.provider || provider.name,
          customerMessage: dto.customerMessage || null,
          status: PaymentStatus.PENDING,
          description: dto.description || null,
          metadata: dto.metadata || null
        });

        const attempt = await PaymentAttempt.create({
          paymentId: payment.id,
          attemptNumber: 1,
          provider: provider.name,
          status: 'SUBMITTED',
          requestPayload: {
            type: 'PAYOUT',
            amount: dto.amount,
            currency: dto.currency,
            country: dto.country,
            reference: dto.reference
          }
        });

        try {
          const providerResult = await provider.initiatePayout({
            paymentId: payment.id,
            reference: dto.reference,
            amount: dto.amount,
            currency: dto.currency,
            phoneNumber: dto.phoneNumber,
            country: dto.country,
            provider: dto.provider,
            description: dto.description,
            customerMessage: dto.customerMessage,
            metadata: dto.metadata
          });

          if (providerResult.status === 'ACCEPTED' || providerResult.status === 'DUPLICATE_IGNORED') {
            await this.repo.update(payment.id, {
              status: PaymentStatus.PROCESSING,
              providerPaymentId: providerResult.providerPaymentId
            });

            await attempt.update({
              status: 'ACCEPTED',
              providerRequestId: providerResult.providerPaymentId,
              responsePayload: (providerResult.rawResponse as Record<string, unknown>) || null
            });

            const updated = await this.repo.findById(payment.id, applicationId);
            const response = this.mapToResponse(updated!);

            await this.notification.createNotification(updated!, 'payout.processing');

            return {
              statusCode: 202,
              body: response,
              resourceId: payment.id
            };
          }

          await this.repo.update(payment.id, {
            status: PaymentStatus.FAILED,
            failureReason: providerResult.error?.message || 'Payout rejected by provider',
            failedAt: new Date()
          });

          await attempt.update({
            status: 'REJECTED',
            errorCode: providerResult.error?.code,
            errorMessage: providerResult.error?.message,
            responsePayload: (providerResult.rawResponse as Record<string, unknown>) || null
          });

          const failed = await this.repo.findById(payment.id, applicationId);
          const response = this.mapToResponse(failed!);

          await this.notification.createNotification(failed!, 'payout.failed');

          return {
            statusCode: 422,
            body: response,
            resourceId: payment.id
          };
        } catch (providerErr: unknown) {
          logger.error(
            { err: providerErr, paymentId: payment.id },
            'Payment provider payout invocation failed'
          );

          await attempt.update({
            status: 'ERROR',
            errorMessage: providerErr instanceof Error ? providerErr.message : String(providerErr)
          });

          throw new ProviderError(
            providerErr instanceof Error ? providerErr.message : 'Payment provider error',
            provider.name
          );
        }
      }
    );

    return {
      response: idempotentExecution.body,
      statusCode: idempotentExecution.statusCode,
      cached: idempotentExecution.cached
    };
  }

  async createRefund(
    applicationId: string,
    dto: CreateRefundDto,
    idempotencyKey?: string,
    providerOverride?: PaymentProvider
  ): Promise<{ response: PaymentResponse; statusCode: number; cached: boolean }> {
    const provider = providerOverride || getPaymentProvider();

    const idempotentExecution = await this.idempotency.executeWithIdempotency<PaymentResponse>(
      applicationId,
      idempotencyKey,
      dto,
      async () => {
        const originalPayment = await this.repo.findById(dto.depositPaymentId, applicationId);
        if (!originalPayment) {
          throw new NotFoundError('Deposit payment', dto.depositPaymentId);
        }

        if (originalPayment.type !== PaymentType.DEPOSIT) {
          throw new ValidationError(`Payment '${dto.depositPaymentId}' is not a deposit`);
        }

        if (originalPayment.status !== PaymentStatus.COMPLETED) {
          throw new ValidationError(
            `Cannot refund payment in '${originalPayment.status}' status. Only COMPLETED payments can be refunded.`
          );
        }

        const existingRefunds = await this.repo.findRefundsForDeposit(originalPayment.id);
        const activeRefunds = existingRefunds.filter(
          (r) =>
            r.status === PaymentStatus.COMPLETED ||
            r.status === PaymentStatus.PROCESSING ||
            r.status === PaymentStatus.PENDING
        );
        const totalRefunded = activeRefunds.reduce((sum, r) => sum + Number(r.amount), 0);
        const maxRefundable = Number(originalPayment.amount) - totalRefunded;

        const refundAmount = dto.amount ?? Number(originalPayment.amount);
        if (refundAmount <= 0) {
          throw new ValidationError('Refund amount must be greater than zero');
        }

        if (refundAmount > maxRefundable) {
          throw new ValidationError(
            `Refund amount (${refundAmount}) exceeds maximum refundable amount (${maxRefundable})`
          );
        }

        const existingReference = await this.repo.findByReference(dto.reference, applicationId);
        if (existingReference) {
          throw new ConflictError(
            `Payment with reference '${dto.reference}' already exists for this application`
          );
        }

        const currency = dto.currency || originalPayment.currency;

        const payment = await this.repo.create({
          applicationId,
          reference: dto.reference,
          type: PaymentType.REFUND,
          amount: refundAmount,
          currency,
          phoneNumber: originalPayment.phoneNumber,
          country: originalPayment.country,
          provider: originalPayment.provider,
          originalPaymentId: originalPayment.id,
          status: PaymentStatus.PENDING,
          description: dto.description || `Refund for ${originalPayment.reference}`,
          metadata: dto.metadata || null
        });

        const attempt = await PaymentAttempt.create({
          paymentId: payment.id,
          attemptNumber: 1,
          provider: provider.name,
          status: 'SUBMITTED',
          requestPayload: {
            type: 'REFUND',
            amount: refundAmount,
            currency,
            originalPaymentId: originalPayment.id,
            reference: dto.reference
          }
        });

        try {
          const providerResult = await provider.initiateRefund({
            refundId: payment.id,
            depositId: originalPayment.id,
            amount: refundAmount,
            currency,
            metadata: dto.metadata
          });

          if (providerResult.status === 'ACCEPTED' || providerResult.status === 'DUPLICATE_IGNORED') {
            await this.repo.update(payment.id, {
              status: PaymentStatus.PROCESSING,
              providerPaymentId: payment.id
            });

            await attempt.update({
              status: 'ACCEPTED',
              providerRequestId: payment.id,
              responsePayload: (providerResult.rawResponse as Record<string, unknown>) || null
            });

            const updated = await this.repo.findById(payment.id, applicationId);
            const response = this.mapToResponse(updated!);

            await this.notification.createNotification(updated!, 'refund.processing');

            return {
              statusCode: 202,
              body: response,
              resourceId: payment.id
            };
          }

          await this.repo.update(payment.id, {
            status: PaymentStatus.FAILED,
            failureReason: providerResult.error?.message || 'Refund rejected by provider',
            failedAt: new Date()
          });

          await attempt.update({
            status: 'REJECTED',
            errorCode: providerResult.error?.code,
            errorMessage: providerResult.error?.message,
            responsePayload: (providerResult.rawResponse as Record<string, unknown>) || null
          });

          const failed = await this.repo.findById(payment.id, applicationId);
          const response = this.mapToResponse(failed!);

          await this.notification.createNotification(failed!, 'refund.failed');

          return {
            statusCode: 422,
            body: response,
            resourceId: payment.id
          };
        } catch (providerErr: unknown) {
          logger.error(
            { err: providerErr, paymentId: payment.id },
            'Payment provider refund invocation failed'
          );

          await attempt.update({
            status: 'ERROR',
            errorMessage: providerErr instanceof Error ? providerErr.message : String(providerErr)
          });

          throw new ProviderError(
            providerErr instanceof Error ? providerErr.message : 'Payment provider error',
            provider.name
          );
        }
      }
    );

    return {
      response: idempotentExecution.body,
      statusCode: idempotentExecution.statusCode,
      cached: idempotentExecution.cached
    };
  }

  async getPaymentById(id: string, applicationId: string): Promise<PaymentResponse> {
    const payment = await this.repo.findById(id, applicationId);
    if (!payment) {
      throw new NotFoundError('Payment', id);
    }
    return this.mapToResponse(payment);
  }

  async getPaymentByReference(reference: string, applicationId: string): Promise<PaymentResponse> {
    const payment = await this.repo.findByReference(reference, applicationId);
    if (!payment) {
      throw new NotFoundError('Payment with reference', reference);
    }
    return this.mapToResponse(payment);
  }

  async listPayments(
    applicationId: string,
    filters: PaymentFilters,
    offset = 0,
    limit = 20
  ): Promise<{ payments: PaymentResponse[]; total: number }> {
    const { rows, count } = await this.repo.list(applicationId, filters, offset, limit);
    return {
      payments: rows.map((p) => this.mapToResponse(p)),
      total: count
    };
  }

  async transitionStatus(
    payment: Payment,
    newStatus: PaymentStatus,
    reason?: string,
    providerTransactionId?: string,
    transaction?: Transaction
  ): Promise<Payment> {
    const currentStatus = payment.status;

    // Idempotent state change
    if (currentStatus === newStatus) {
      return payment;
    }

    if (!isValidTransition(currentStatus, newStatus)) {
      throw new InvalidStateTransitionError(currentStatus, newStatus);
    }

    const updates: Partial<Payment> = {
      status: newStatus
    };

    if (newStatus === PaymentStatus.COMPLETED) {
      updates.completedAt = new Date();
    } else if (newStatus === PaymentStatus.FAILED) {
      updates.failedAt = new Date();
      if (reason) updates.failureReason = reason;
    } else if (reason) {
      updates.failureReason = reason;
    }

    if (providerTransactionId && !payment.providerPaymentId) {
      updates.providerPaymentId = providerTransactionId;
    }

    await payment.update(updates, { transaction });

    // Trigger state change notification
    const eventName = `payment.${newStatus.toLowerCase()}`;
    await this.notification.createNotification(payment, eventName, transaction);

    logger.info(
      {
        paymentId: payment.id,
        applicationId: payment.applicationId,
        fromStatus: currentStatus,
        toStatus: newStatus
      },
      'Payment state transition completed'
    );

    return payment;
  }
}

export const paymentService = new PaymentService();
export default paymentService;
