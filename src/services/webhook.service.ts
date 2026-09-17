import { webhookRepository, WebhookRepository } from '../repositories/webhook.repository.js';
import { paymentRepository, PaymentRepository } from '../repositories/payment.repository.js';
import { paymentService, PaymentService } from './payment.service.js';
import { pawapaySignatureVerifier, PawapaySignatureVerifier } from '../integrations/pawapay/pawapay.signature.js';
import { PawapayMapper } from '../integrations/pawapay/pawapay.mapper.js';
import { PawapayCallbackPayload } from '../integrations/pawapay/pawapay.types.js';
import { WebhookEventStatus } from '../models/webhook-event.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { AuthenticationError } from '../utils/errors.js';
import { sequelize } from '../config/database.js';
import { logger } from '../config/logger.js';

export interface WebhookProcessResult {
  acknowledged: boolean;
  duplicate: boolean;
  paymentId?: string;
  status?: string;
}

export class WebhookService {
  constructor(
    private readonly repo: WebhookRepository = webhookRepository,
    private readonly paymentRepo: PaymentRepository = paymentRepository,
    private readonly payments: PaymentService = paymentService,
    private readonly verifier: PawapaySignatureVerifier = pawapaySignatureVerifier
  ) {}

  async processPawapayCallback(
    headers: Record<string, string | string[] | undefined>,
    payload: PawapayCallbackPayload,
    rawBody?: Buffer,
    ipAddress?: string
  ): Promise<WebhookProcessResult> {
    // Step 1: Verify webhook signature if enabled
    const isValidSignature = await this.verifier.verifySignature(headers, rawBody);
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
    const failureReason = payload.failureReason?.failureMessage || undefined;
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
}

export const webhookService = new WebhookService();
export default webhookService;
