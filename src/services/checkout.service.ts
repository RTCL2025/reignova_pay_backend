import crypto from 'node:crypto';
import { Transaction } from 'sequelize';
import { checkoutRepository, CheckoutRepository, CheckoutFilters } from '../repositories/checkout.repository.js';
import { idempotencyService, IdempotencyService } from './idempotency.service.js';
import { Checkout, CheckoutStatus } from '../models/checkout.model.js';
import { PaymentProvider } from '../types/provider.types.js';
import { getPaymentProvider } from './payment.service.js';
import { env } from '../config/env.js';
import {
  ConflictError,
  NotFoundError,
  ProviderError
} from '../utils/errors.js';
import { logger } from '../config/logger.js';
import { receiptService } from './receipt.service.js';
import { notificationService, NotificationService } from './notification.service.js';

export interface CreateCheckoutDto {
  reference: string;
  returnUrl: string;
  successUrl?: string;
  cancelUrl?: string;
  returnMethod?: string;
  defaultLanguage?: string;
  countries?: string[];
  amounts?: Array<{ country: string; currency: string; amount: number | string }>;
  amount?: number | string;
  currency?: string;
  country?: string;
  provider?: string;
  description?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    phoneNumber?: string;
  };
  payer?: {
    phoneNumber?: string;
    email?: string;
    name?: string;
    allowCustomerToOverride?: boolean;
    [key: string]: unknown;
  };
  reason?: Record<string, unknown> | string;
  expiresAfter?: number;
  metadata?: Record<string, unknown>;
}

export interface CheckoutResponse {
  id: string;
  applicationId: string;
  reference: string;
  publicToken?: string | null;
  checkoutUrl?: string | null;
  providerCheckoutId?: string | null;
  redirectUrl?: string | null;
  checkoutCode?: string | null;
  returnUrl: string;
  cancelUrl?: string | null;
  returnMethod?: string | null;
  status: CheckoutStatus;
  defaultLanguage?: string | null;
  countries?: string[] | null;
  amounts?: Array<{ country: string; currency: string; amount: number | string }> | null;
  payer?: Record<string, unknown> | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
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
    private readonly idempotency: IdempotencyService = idempotencyService,
    private readonly notifications: NotificationService = notificationService
  ) {}

  public mapToResponse(checkout: Checkout): CheckoutResponse {
    const checkoutUrl = checkout.publicToken
      ? `${env.CHECKOUT_BASE_URL}/checkout/${checkout.publicToken}`
      : checkout.redirectUrl || null;

    return {
      id: checkout.id,
      applicationId: checkout.applicationId,
      reference: checkout.reference,
      publicToken: checkout.publicToken,
      checkoutUrl,
      providerCheckoutId: checkout.providerCheckoutId,
      redirectUrl: checkout.redirectUrl,
      checkoutCode: checkout.checkoutCode,
      returnUrl: checkout.returnUrl,
      cancelUrl: checkout.cancelUrl,
      returnMethod: checkout.returnMethod,
      status: checkout.status,
      defaultLanguage: checkout.defaultLanguage,
      countries: checkout.countries,
      amounts: checkout.amounts,
      payer: checkout.payer,
      customerName: checkout.customerName,
      customerEmail: checkout.customerEmail,
      customerPhone: checkout.customerPhone,
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

        // Generate cryptographically secure public session token
        const publicToken = 'cs_sec_' + crypto.randomBytes(24).toString('hex');

        // Normalize amounts
        let normalizedAmounts = dto.amounts || null;
        if (!normalizedAmounts && dto.amount) {
          normalizedAmounts = [
            {
              country: dto.country || 'TZA',
              currency: dto.currency || 'TZS',
              amount: dto.amount
            }
          ];
        }

        // Normalize customer info
        const customerName = dto.customer?.name || dto.payer?.name || null;
        const customerEmail = dto.customer?.email || dto.payer?.email || null;
        const customerPhone =
          dto.customer?.phone ||
          dto.customer?.phoneNumber ||
          dto.payer?.phoneNumber ||
          null;

        const payerObj = {
          ...dto.payer,
          ...(dto.provider ? { provider: dto.provider } : {}),
          ...(customerName ? { name: customerName } : {}),
          ...(customerEmail ? { email: customerEmail } : {}),
          ...(customerPhone ? { phoneNumber: customerPhone } : {})
        };

        // Normalize reason / description
        let reasonObj: Record<string, unknown> | null = null;
        if (typeof dto.reason === 'string') {
          reasonObj = { description: dto.reason };
        } else if (dto.reason && typeof dto.reason === 'object') {
          reasonObj = dto.reason as Record<string, unknown>;
        } else if (dto.description) {
          reasonObj = { description: dto.description };
        }

        const returnUrl = dto.returnUrl || dto.successUrl || '';

        const checkout = await this.repo.create({
          applicationId,
          reference: dto.reference,
          publicToken,
          returnUrl,
          cancelUrl: dto.cancelUrl || null,
          customerName,
          customerEmail,
          customerPhone,
          returnMethod: dto.returnMethod || 'INSTANT',
          status: CheckoutStatus.PENDING,
          defaultLanguage: dto.defaultLanguage || 'en',
          countries: dto.countries || (dto.country ? [dto.country] : null),
          amounts: normalizedAmounts,
          payer: Object.keys(payerObj).length > 0 ? payerObj : null,
          reason: reasonObj,
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
            countries: checkout.countries || (dto.countries ? dto.countries : dto.country ? [dto.country] : undefined),
            amounts: checkout.amounts || normalizedAmounts || dto.amounts,
            payer: (checkout.payer as Record<string, unknown> | undefined) || (Object.keys(payerObj).length > 0 ? payerObj : undefined) || dto.payer,
            reason: (checkout.reason as Record<string, unknown> | undefined) || reasonObj || dto.reason,
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

    if (newStatus === CheckoutStatus.COMPLETED) {
      receiptService.sendReceiptEmail(checkout).catch((err) => {
        logger.error(
          { err, checkoutId: checkout.id },
          'Background dispatch of receipt email failed'
        );
      });
    }

    // Tell the merchant. A hosted checkout has no local payment row, so this is
    // the only webhook they will ever get for it — without this the merchant
    // never learns the checkout resolved and the order stays unpaid on their
    // side until a human notices.
    //
    // Enqueuing must not be able to undo a state change pawaPay has already
    // confirmed to us, so a failure here is logged and left to the retry
    // sweeper rather than thrown.
    try {
      await this.notifications.createCheckoutNotification(
        checkout,
        `checkout.${newStatus.toLowerCase()}`,
        transaction
      );
    } catch (err) {
      logger.error(
        { err, checkoutId: checkout.id, status: newStatus },
        'Could not enqueue merchant notification for checkout transition'
      );
    }

    return checkout;
  }
}

export const checkoutService = new CheckoutService();
export default checkoutService;
