import { Transaction } from 'sequelize';
import { checkoutRepository, CheckoutRepository, CheckoutFilters } from '../repositories/checkout.repository.js';
import { idempotencyService, IdempotencyService } from './idempotency.service.js';
import { Checkout, CheckoutStatus } from '../models/checkout.model.js';
import { PaymentProvider } from '../types/provider.types.js';
import { getPaymentProvider } from './payment.service.js';
import {
  ConflictError,
  NotFoundError,
  ProviderError
} from '../utils/errors.js';
import { logger } from '../config/logger.js';

export interface CreateCheckoutDto {
  reference: string;
  returnUrl: string;
  returnMethod?: string;
  defaultLanguage?: string;
  countries?: string[];
  amounts?: Array<{ country: string; currency: string; amount: number | string }>;
  payer?: {
    phoneNumber?: string;
    email?: string;
    name?: string;
    allowCustomerToOverride?: boolean;
    [key: string]: unknown;
  };
  reason?: Record<string, unknown>;
  expiresAfter?: number;
  metadata?: Record<string, unknown>;
}

export interface CheckoutResponse {
  id: string;
  applicationId: string;
  reference: string;
  providerCheckoutId?: string | null;
  redirectUrl?: string | null;
  checkoutCode?: string | null;
  returnUrl: string;
  returnMethod?: string | null;
  status: CheckoutStatus;
  defaultLanguage?: string | null;
  countries?: string[] | null;
  amounts?: Array<{ country: string; currency: string; amount: number | string }> | null;
  payer?: Record<string, unknown> | null;
  reason?: Record<string, unknown> | null;
  expiresAfter?: number | null;
  expiresAt?: Date | null;
  depositId?: string | null;
  depositStatus?: string | null;
  depositsHistory?: Array<Record<string, unknown>> | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown> | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  expiredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CheckoutService {
  constructor(
    private readonly repo: CheckoutRepository = checkoutRepository,
    private readonly idempotency: IdempotencyService = idempotencyService
  ) {}

  public mapToResponse(checkout: Checkout): CheckoutResponse {
    return {
      id: checkout.id,
      applicationId: checkout.applicationId,
      reference: checkout.reference,
      providerCheckoutId: checkout.providerCheckoutId,
      redirectUrl: checkout.redirectUrl,
      checkoutCode: checkout.checkoutCode,
      returnUrl: checkout.returnUrl,
      returnMethod: checkout.returnMethod,
      status: checkout.status,
      defaultLanguage: checkout.defaultLanguage,
      countries: checkout.countries,
      amounts: checkout.amounts,
      payer: checkout.payer,
      reason: checkout.reason,
      expiresAfter: checkout.expiresAfter,
      expiresAt: checkout.expiresAt,
      depositId: checkout.depositId,
      depositStatus: checkout.depositStatus,
      depositsHistory: checkout.depositsHistory,
      failureReason: checkout.failureReason,
      metadata: checkout.metadata,
      completedAt: checkout.completedAt,
      failedAt: checkout.failedAt,
      expiredAt: checkout.expiredAt,
      createdAt: checkout.createdAt,
      updatedAt: checkout.updatedAt
    };
  }

  async createCheckout(
    applicationId: string,
    dto: CreateCheckoutDto,
    idempotencyKey?: string,
    providerOverride?: PaymentProvider
  ): Promise<{ response: CheckoutResponse; statusCode: number; cached: boolean }> {
    const provider = providerOverride || getPaymentProvider();

    const idempotentExecution = await this.idempotency.executeWithIdempotency<CheckoutResponse>(
      applicationId,
      idempotencyKey,
      dto,
      async () => {
        const existingCheckout = await this.repo.findByReference(dto.reference, applicationId);
        if (existingCheckout) {
          throw new ConflictError(
            `Checkout with reference '${dto.reference}' already exists for this application`
          );
        }

        const expiresAt = dto.expiresAfter
          ? new Date(Date.now() + dto.expiresAfter * 60 * 1000)
          : undefined;

        const checkout = await this.repo.create({
          applicationId,
          reference: dto.reference,
          returnUrl: dto.returnUrl,
          returnMethod: dto.returnMethod || 'GET',
          status: CheckoutStatus.PENDING,
          defaultLanguage: dto.defaultLanguage || 'en',
          countries: dto.countries || null,
          amounts: dto.amounts || null,
          payer: dto.payer || null,
          reason: dto.reason || null,
          expiresAfter: dto.expiresAfter || null,
          expiresAt: expiresAt || null,
          metadata: dto.metadata || null
        });

        try {
          const providerResult = await provider.initiateCheckout({
            checkoutId: checkout.id,
            reference: dto.reference,
            returnUrl: dto.returnUrl,
            returnMethod: dto.returnMethod,
            defaultLanguage: dto.defaultLanguage,
            countries: dto.countries,
            amounts: dto.amounts,
            payer: dto.payer,
            reason: dto.reason,
            expiresAfter: dto.expiresAfter,
            metadata: dto.metadata
          });

          if (
            providerResult.status === 'WAITING_PAYMENT' ||
            providerResult.status === 'PROCESSING' ||
            providerResult.status === 'COMPLETED'
          ) {
            const mappedStatus =
              providerResult.status === 'COMPLETED'
                ? CheckoutStatus.COMPLETED
                : providerResult.status === 'PROCESSING'
                ? CheckoutStatus.PROCESSING
                : CheckoutStatus.WAITING_PAYMENT;

            await this.repo.update(checkout.id, {
              status: mappedStatus,
              providerCheckoutId: providerResult.checkoutId || checkout.id,
              redirectUrl: providerResult.redirectUrl,
              checkoutCode: providerResult.checkoutCode,
              expiresAt: providerResult.expiresAt ? new Date(providerResult.expiresAt) : checkout.expiresAt
            });

            const updated = await this.repo.findById(checkout.id, applicationId);
            const response = this.mapToResponse(updated!);

            return {
              statusCode: 201,
              body: response,
              resourceId: checkout.id
            };
          }

          await this.repo.update(checkout.id, {
            status: CheckoutStatus.FAILED,
            failureReason: providerResult.error?.message || 'Checkout creation rejected by provider',
            failedAt: new Date()
          });

          const failed = await this.repo.findById(checkout.id, applicationId);
          const response = this.mapToResponse(failed!);

          return {
            statusCode: 422,
            body: response,
            resourceId: checkout.id
          };
        } catch (providerErr: unknown) {
          logger.error(
            { err: providerErr, checkoutId: checkout.id },
            'Payment provider checkout invocation failed'
          );

          await this.repo.update(checkout.id, {
            status: CheckoutStatus.FAILED,
            failureReason: providerErr instanceof Error ? providerErr.message : String(providerErr),
            failedAt: new Date()
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

  async getCheckoutById(id: string, applicationId: string): Promise<CheckoutResponse> {
    const checkout = await this.repo.findById(id, applicationId);
    if (!checkout) {
      throw new NotFoundError('Checkout', id);
    }
    return this.mapToResponse(checkout);
  }

  async getCheckoutByCode(code: string, applicationId?: string): Promise<CheckoutResponse> {
    const checkout = await this.repo.findByCode(code, applicationId);
    if (!checkout) {
      throw new NotFoundError('Checkout with code', code);
    }
    return this.mapToResponse(checkout);
  }

  async listCheckouts(
    applicationId: string,
    filters: CheckoutFilters,
    offset = 0,
    limit = 20
  ): Promise<{ checkouts: CheckoutResponse[]; total: number }> {
    const { rows, count } = await this.repo.list(applicationId, filters, offset, limit);
    return {
      checkouts: rows.map((c) => this.mapToResponse(c)),
      total: count
    };
  }

  async expireCheckout(id: string, applicationId: string): Promise<CheckoutResponse> {
    const checkout = await this.repo.findById(id, applicationId);
    if (!checkout) {
      throw new NotFoundError('Checkout', id);
    }

    if (checkout.status === CheckoutStatus.COMPLETED) {
      throw new ConflictError('Cannot expire an already completed checkout');
    }

    await this.repo.update(checkout.id, {
      status: CheckoutStatus.EXPIRED,
      expiredAt: new Date()
    });

    const updated = await this.repo.findById(id, applicationId);
    return this.mapToResponse(updated!);
  }

  async transitionCheckoutStatus(
    checkout: Checkout,
    newStatus: CheckoutStatus,
    reason?: string,
    details?: {
      depositId?: string;
      depositStatus?: string;
      depositsHistory?: Array<Record<string, unknown>>;
    },
    transaction?: Transaction
  ): Promise<Checkout> {
    if (checkout.status === newStatus) {
      return checkout;
    }

    const updates: Partial<Checkout> = {
      status: newStatus
    };

    if (newStatus === CheckoutStatus.COMPLETED) {
      updates.completedAt = new Date();
    } else if (newStatus === CheckoutStatus.FAILED) {
      updates.failedAt = new Date();
      if (reason) updates.failureReason = reason;
    } else if (newStatus === CheckoutStatus.EXPIRED) {
      updates.expiredAt = new Date();
    }

    if (details?.depositId) {
      updates.depositId = details.depositId;
    }
    if (details?.depositStatus) {
      updates.depositStatus = details.depositStatus;
    }
    if (details?.depositsHistory) {
      updates.depositsHistory = details.depositsHistory;
    }

    await checkout.update(updates, { transaction });

    logger.info(
      {
        checkoutId: checkout.id,
        applicationId: checkout.applicationId,
        fromStatus: checkout.status,
        toStatus: newStatus
      },
      'Checkout state transition completed'
    );

    return checkout;
  }
}

export const checkoutService = new CheckoutService();
export default checkoutService;
