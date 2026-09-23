import { webhookRepository, WebhookRepository } from '../repositories/webhook.repository.js';
import { paymentRepository, PaymentRepository } from '../repositories/payment.repository.js';
import { checkoutRepository, CheckoutRepository } from '../repositories/checkout.repository.js';
import { paymentService, PaymentService } from './payment.service.js';
import { checkoutService, CheckoutService } from './checkout.service.js';
import { pawapaySignatureVerifier, PawapaySignatureVerifier } from '../integrations/pawapay/pawapay.signature.js';
import { PawapayMapper } from '../integrations/pawapay/pawapay.mapper.js';
import { CheckoutStatus } from '../models/checkout.model.js';
import {
  PawapayCallbackPayload,
  PawapayPayoutCallbackPayload,
  PawapayRefundCallbackPayload,
  PawapayCheckoutCallbackPayload
} from '../integrations/pawapay/pawapay.types.js';
import { WebhookEventStatus } from '../models/webhook-event.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { AuthenticationError } from '../utils/errors.js';
import { sequelize } from '../config/database.js';
import { logger } from '../config/logger.js';

export interface WebhookProcessResult {
  acknowledged: boolean;
  duplicate: boolean;
  paymentId?: string;
  checkoutId?: string;
  status?: string;
}

/**
 * The parts of the inbound HTTP request that pawaPay covers with its RFC-9421
 * signature. Its documented `Signature-Input` includes `@method`, `@authority`
 * and `@path`, so the signature base cannot be rebuilt without them — omitting
 * these made the verifier fall back to `@path: /`, which never matches a
 * callback signed for `/api/v1/webhooks/pawapay/checkouts`.
 */
export interface CallbackRequestInfo {
  method?: string;
  authority?: string;
  path?: string;
}

/** pawaPay reports a failure under either key depending on the callback type. */
function failureReasonOf(payload: {
  failureReason?: { failureMessage?: string; message?: string } | string | null;
}): string | undefined {
  const reason = payload.failureReason;
  if (!reason) return undefined;
  if (typeof reason === 'string') return reason;
  return reason.failureMessage || reason.message || undefined;
}

export class WebhookService {
  constructor(
    private readonly repo: WebhookRepository = webhookRepository,
    private readonly paymentRepo: PaymentRepository = paymentRepository,
    private readonly checkoutRepo: CheckoutRepository = checkoutRepository,
    private readonly payments: PaymentService = paymentService,
    private readonly checkouts: CheckoutService = checkoutService,
    private readonly verifier: PawapaySignatureVerifier = pawapaySignatureVerifier
  ) {}

  async processPawapayCallback(
    headers: Record<string, string | string[] | undefined>,
    payload: PawapayCallbackPayload,
    rawBody?: Buffer,
    ipAddress?: string,
    requestInfo?: CallbackRequestInfo
  ): Promise<WebhookProcessResult> {
    // Step 1: Verify webhook signature if enabled
    const isValidSignature = await this.verifier.verifySignature(headers, rawBody, requestInfo);
    if (!isValidSignature) {
      logger.warn({ depositId: payload.depositId }, 'Pawapay webhook rejected: invalid signature');
      throw new AuthenticationError('Invalid webhook signature');
    }

    const provider = 'pawapay';
    const eventKey = payload.depositId;

    // Step 2: Check for duplicate webhook delivery (Idempotency)
    const existingEvent = await this.repo.findByEventKey(provider, eventKey);
    if (existingEvent) {
      logger.info(
        { depositId: payload.depositId, status: existingEvent.status },
        'Duplicate Pawapay webhook received, acknowledging safely'
      );
      return {
        acknowledged: true,
        duplicate: true,
        paymentId: existingEvent.paymentId || undefined,
        status: existingEvent.status
      };
    }

    // Step 3: Record initial webhook event as RECEIVED
    const webhookEvent = await this.repo.create({
      provider,
      eventKey,
      eventType: `deposit.${payload.status.toLowerCase()}`,
      providerPaymentId: payload.depositId,
      payload: payload as unknown as Record<string, unknown>,
      status: WebhookEventStatus.RECEIVED
    });

    // Step 4: Locate corresponding payment
    // Note: depositId in Pawapay was set to payment.id
    let payment = await this.paymentRepo.findByPk(payload.depositId);
    if (!payment) {
      payment = await this.paymentRepo.findByProviderPaymentId(payload.depositId);
    }

    if (!payment) {
      // A hosted checkout has no local payment row — pawaPay creates the deposit
      // itself — so the deposit callback for one lands here. Dropping it meant
      // acknowledging the money and never telling the merchant, with pawaPay
      // seeing a 200 and never retrying. Resolve it through the checkout the
      // deposit belongs to instead.
      const linkedCheckout = await this.checkoutRepo.findByDepositId(payload.depositId);

      if (linkedCheckout) {
        const checkoutStatus = PawapayMapper.toCheckoutStatus(payload.status);

        await this.checkouts.transitionCheckoutStatus(
          linkedCheckout,
          checkoutStatus,
          failureReasonOf(payload),
          {
            depositId: payload.depositId,
            depositStatus: payload.status
          }
        );

        await this.repo.update(webhookEvent.id, {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date()
        });

        logger.info(
          {
            depositId: payload.depositId,
            checkoutId: linkedCheckout.id,
            newStatus: checkoutStatus
          },
          'Deposit callback resolved through its linked checkout'
        );

        return {
          acknowledged: true,
          duplicate: false,
          checkoutId: linkedCheckout.id,
          status: checkoutStatus
        };
      }

      logger.error(
        { depositId: payload.depositId },
        'Payment not found for incoming Pawapay webhook'
      );
      await this.repo.update(webhookEvent.id, {
        status: WebhookEventStatus.FAILED
      });
      return {
        acknowledged: true,
        duplicate: false
      };
    }

    // Link paymentId to webhook event
    await this.repo.update(webhookEvent.id, { paymentId: payment.id });

    // Step 5: Transition payment status in a database transaction
    const targetStatus = PawapayMapper.toPaymentStatus(payload.status);
    const failureReason =
      payload.failureReason?.failureMessage ||
      payload.failureReason?.message ||
      undefined;
    const providerTxId = payload.providerTransactionId;

    const t = await sequelize.transaction();
    try {
      await this.payments.transitionStatus(
        payment,
        targetStatus,
        failureReason,
        providerTxId,
        t
      );

      // Synchronize linked checkout if this deposit belongs to a checkout session
      let linkedCheckout = await this.checkoutRepo.findByDepositId(payment.id);
      if (!linkedCheckout && payment.metadata) {
        const metaCheckoutId = (payment.metadata.checkoutId || payment.metadata.providerCheckoutId) as string | undefined;
        if (metaCheckoutId) {
          linkedCheckout = (await this.checkoutRepo.findById(metaCheckoutId, payment.applicationId)) ||
                           (await this.checkoutRepo.findByProviderCheckoutId(metaCheckoutId));
        }
      }
      if (linkedCheckout) {
        let checkoutTargetStatus = CheckoutStatus.PROCESSING;
        if (targetStatus === 'COMPLETED') {
          checkoutTargetStatus = CheckoutStatus.COMPLETED;
        } else if (targetStatus === 'FAILED') {
          checkoutTargetStatus = CheckoutStatus.FAILED;
        }

        await this.checkouts.transitionCheckoutStatus(
          linkedCheckout,
          checkoutTargetStatus,
          failureReason,
          {
            depositId: payment.id,
            depositStatus: targetStatus
          },
          t
        );
      }

      await this.repo.update(
        webhookEvent.id,
        {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date()
        },
        t
      );

      await AuditLog.create(
        {
          actor: 'webhook:pawapay',
          applicationId: payment.applicationId,
          resourceType: 'payment',
          resourceId: payment.id,
          action: 'webhook_status_update',
          metadata: {
            pawapayStatus: payload.status,
            targetStatus,
            providerTransactionId: providerTxId
          },
          ipAddress: ipAddress || null
        },
        { transaction: t }
      );

      await t.commit();

      logger.info(
        {
          paymentId: payment.id,
          newStatus: targetStatus,
          providerPaymentId: payload.depositId
        },
        'Pawapay webhook processed successfully'
      );

      return {
        acknowledged: true,
        duplicate: false,
        paymentId: payment.id,
        status: targetStatus
      };
    } catch (err) {
      await t.rollback();
      logger.error({ err, depositId: payload.depositId }, 'Error processing webhook status change');
      await this.repo.update(webhookEvent.id, { status: WebhookEventStatus.FAILED });
      throw err;
    }
  }

  async processPawapayPayoutCallback(
    headers: Record<string, string | string[] | undefined>,
    payload: PawapayPayoutCallbackPayload,
    rawBody?: Buffer,
    ipAddress?: string,
    requestInfo?: CallbackRequestInfo
  ): Promise<WebhookProcessResult> {
    const isValidSignature = await this.verifier.verifySignature(headers, rawBody, requestInfo);
    if (!isValidSignature) {
      logger.warn({ payoutId: payload.payoutId }, 'Pawapay payout webhook rejected: invalid signature');
      throw new AuthenticationError('Invalid webhook signature');
    }

    const provider = 'pawapay';
    const eventKey = payload.payoutId;

    const existingEvent = await this.repo.findByEventKey(provider, eventKey);
    if (existingEvent) {
      logger.info(
        { payoutId: payload.payoutId, status: existingEvent.status },
        'Duplicate Pawapay payout webhook received, acknowledging safely'
      );
      return {
        acknowledged: true,
        duplicate: true,
        paymentId: existingEvent.paymentId || undefined,
        status: existingEvent.status
      };
    }

    const webhookEvent = await this.repo.create({
      provider,
      eventKey,
      eventType: `payout.${payload.status.toLowerCase()}`,
      providerPaymentId: payload.payoutId,
      payload: payload as unknown as Record<string, unknown>,
      status: WebhookEventStatus.RECEIVED
    });

    let payment = await this.paymentRepo.findByPk(payload.payoutId);
    if (!payment) {
      payment = await this.paymentRepo.findByProviderPaymentId(payload.payoutId);
    }

    if (!payment) {
      logger.error(
        { payoutId: payload.payoutId },
        'Payment not found for incoming Pawapay payout webhook'
      );
      await this.repo.update(webhookEvent.id, {
        status: WebhookEventStatus.FAILED
      });
      return {
        acknowledged: true,
        duplicate: false
      };
    }

    await this.repo.update(webhookEvent.id, { paymentId: payment.id });

    const targetStatus = PawapayMapper.toPaymentStatus(payload.status);
    const failureReason =
      payload.failureReason?.failureMessage ||
      payload.failureReason?.message ||
      undefined;
    const providerTxId = payload.providerTransactionId;

    const t = await sequelize.transaction();
    try {
      await this.payments.transitionStatus(
        payment,
        targetStatus,
        failureReason,
        providerTxId,
        t
      );

      await this.repo.update(
        webhookEvent.id,
        {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date()
        },
        t
      );

      await AuditLog.create(
        {
          actor: 'webhook:pawapay',
          applicationId: payment.applicationId,
          resourceType: 'payment',
          resourceId: payment.id,
          action: 'payout_webhook_status_update',
          metadata: {
            pawapayStatus: payload.status,
            targetStatus,
            providerTransactionId: providerTxId
          },
          ipAddress: ipAddress || null
        },
        { transaction: t }
      );

      await t.commit();

      logger.info(
        {
          paymentId: payment.id,
          newStatus: targetStatus,
          providerPaymentId: payload.payoutId
        },
        'Pawapay payout webhook processed successfully'
      );

      return {
        acknowledged: true,
        duplicate: false,
        paymentId: payment.id,
        status: targetStatus
      };
    } catch (err) {
      await t.rollback();
      logger.error({ err, payoutId: payload.payoutId }, 'Error processing payout webhook status change');
      await this.repo.update(webhookEvent.id, { status: WebhookEventStatus.FAILED });
      throw err;
    }
  }

  async processPawapayRefundCallback(
    headers: Record<string, string | string[] | undefined>,
    payload: PawapayRefundCallbackPayload,
    rawBody?: Buffer,
    ipAddress?: string,
    requestInfo?: CallbackRequestInfo
  ): Promise<WebhookProcessResult> {
    const isValidSignature = await this.verifier.verifySignature(headers, rawBody, requestInfo);
    if (!isValidSignature) {
      logger.warn({ refundId: payload.refundId }, 'Pawapay refund webhook rejected: invalid signature');
      throw new AuthenticationError('Invalid webhook signature');
    }

    const provider = 'pawapay';
    const eventKey = payload.refundId;

    const existingEvent = await this.repo.findByEventKey(provider, eventKey);
    if (existingEvent) {
      logger.info(
        { refundId: payload.refundId, status: existingEvent.status },
        'Duplicate Pawapay refund webhook received, acknowledging safely'
      );
      return {
        acknowledged: true,
        duplicate: true,
        paymentId: existingEvent.paymentId || undefined,
        status: existingEvent.status
      };
    }

    const webhookEvent = await this.repo.create({
      provider,
      eventKey,
      eventType: `refund.${payload.status.toLowerCase()}`,
      providerPaymentId: payload.refundId,
      payload: payload as unknown as Record<string, unknown>,
      status: WebhookEventStatus.RECEIVED
    });

    let payment = await this.paymentRepo.findByPk(payload.refundId);
    if (!payment) {
      payment = await this.paymentRepo.findByProviderPaymentId(payload.refundId);
    }

    if (!payment) {
      logger.error(
        { refundId: payload.refundId },
        'Payment not found for incoming Pawapay refund webhook'
      );
      await this.repo.update(webhookEvent.id, {
        status: WebhookEventStatus.FAILED
      });
      return {
        acknowledged: true,
        duplicate: false
      };
    }

    await this.repo.update(webhookEvent.id, { paymentId: payment.id });

    const targetStatus = PawapayMapper.toPaymentStatus(payload.status);
    const failureReason =
      payload.failureReason?.failureMessage ||
      payload.failureReason?.message ||
      undefined;

    const t = await sequelize.transaction();
    try {
      await this.payments.transitionStatus(
        payment,
        targetStatus,
        failureReason,
        undefined,
        t
      );

      await this.repo.update(
        webhookEvent.id,
        {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date()
        },
        t
      );

      await AuditLog.create(
        {
          actor: 'webhook:pawapay',
          applicationId: payment.applicationId,
          resourceType: 'payment',
          resourceId: payment.id,
          action: 'refund_webhook_status_update',
          metadata: {
            pawapayStatus: payload.status,
            targetStatus
          },
          ipAddress: ipAddress || null
        },
        { transaction: t }
      );

      await t.commit();

      logger.info(
        {
          paymentId: payment.id,
          newStatus: targetStatus,
          providerPaymentId: payload.refundId
        },
        'Pawapay refund webhook processed successfully'
      );

      return {
        acknowledged: true,
        duplicate: false,
        paymentId: payment.id,
        status: targetStatus
      };
    } catch (err) {
      await t.rollback();
      logger.error({ err, refundId: payload.refundId }, 'Error processing refund webhook status change');
      await this.repo.update(webhookEvent.id, { status: WebhookEventStatus.FAILED });
      throw err;
    }
  }

  async processPawapayCheckoutCallback(
    headers: Record<string, string | string[] | undefined>,
    payload: PawapayCheckoutCallbackPayload,
    rawBody?: Buffer,
    ipAddress?: string,
    requestInfo?: CallbackRequestInfo
  ): Promise<WebhookProcessResult> {
    const isValidSignature = await this.verifier.verifySignature(headers, rawBody, requestInfo);
    if (!isValidSignature) {
      logger.warn({ checkoutId: payload.checkoutId }, 'Pawapay checkout webhook rejected: invalid signature');
      throw new AuthenticationError('Invalid webhook signature');
    }

    const provider = 'pawapay';
    // Include status in event key: pawaPay sends checkout callbacks for each status
    // transition (WAITING_PAYMENT → PROCESSING → COMPLETED). Using just checkoutId
    // would cause the second callback to be ignored as a duplicate.
    const eventKey = `checkout:${payload.checkoutId}:${payload.status}`;

    const existingEvent = await this.repo.findByEventKey(provider, eventKey);
    if (existingEvent) {
      logger.info(
        { checkoutId: payload.checkoutId, status: existingEvent.status },
        'Duplicate Pawapay checkout webhook received, acknowledging safely'
      );
      return {
        acknowledged: true,
        duplicate: true,
        checkoutId: existingEvent.eventKey || undefined,
        status: existingEvent.status
      };
    }

    const webhookEvent = await this.repo.create({
      provider,
      eventKey,
      eventType: `checkout.${payload.status.toLowerCase()}`,
      providerPaymentId: payload.checkoutId,
      payload: payload as unknown as Record<string, unknown>,
      status: WebhookEventStatus.RECEIVED
    });

    let checkout = await this.checkoutRepo.findByPk(payload.checkoutId);
    if (!checkout) {
      checkout = await this.checkoutRepo.findByProviderCheckoutId(payload.checkoutId);
    }

    if (!checkout) {
      logger.error(
        { checkoutId: payload.checkoutId },
        'Checkout not found for incoming Pawapay checkout webhook'
      );
      await this.repo.update(webhookEvent.id, {
        status: WebhookEventStatus.FAILED
      });
      return {
        acknowledged: true,
        duplicate: false
      };
    }

    const targetStatus = PawapayMapper.toCheckoutStatus(payload.status);
    const failureReason =
      typeof payload.failureReason === 'string'
        ? payload.failureReason
        : payload.failureReason?.failureMessage ||
          payload.failureReason?.message ||
          undefined;

    const t = await sequelize.transaction();
    try {
      await this.checkouts.transitionCheckoutStatus(
        checkout,
        targetStatus,
        failureReason,
        {
          depositId: payload.deposit?.depositId,
          depositStatus: payload.deposit?.status,
          depositsHistory: payload.depositsHistory
        },
        t
      );

      await this.repo.update(
        webhookEvent.id,
        {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date()
        },
        t
      );

      await AuditLog.create(
        {
          actor: 'webhook:pawapay',
          applicationId: checkout.applicationId,
          resourceType: 'checkout',
          resourceId: checkout.id,
          action: 'checkout_webhook_status_update',
          metadata: {
            pawapayStatus: payload.status,
            targetStatus,
            depositId: payload.deposit?.depositId,
            depositStatus: payload.deposit?.status
          },
          ipAddress: ipAddress || null
        },
        { transaction: t }
      );

      await t.commit();

      logger.info(
        {
          checkoutId: checkout.id,
          newStatus: targetStatus,
          providerCheckoutId: payload.checkoutId
        },
        'Pawapay checkout webhook processed successfully'
      );

      return {
        acknowledged: true,
        duplicate: false,
        checkoutId: checkout.id,
        status: targetStatus
      };
    } catch (err) {
      await t.rollback();
      logger.error({ err, checkoutId: payload.checkoutId }, 'Error processing checkout webhook status change');
      await this.repo.update(webhookEvent.id, { status: WebhookEventStatus.FAILED });
      throw err;
    }
  }
}

export const webhookService = new WebhookService();
export default webhookService;
