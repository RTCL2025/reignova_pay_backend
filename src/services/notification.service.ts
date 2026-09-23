import { Transaction } from 'sequelize';
import { notificationRepository, NotificationRepository } from '../repositories/notification.repository.js';
import { applicationRepository, ApplicationRepository } from '../repositories/application.repository.js';
import { Notification, NotificationStatus } from '../models/notification.model.js';
import { Payment } from '../models/payment.model.js';
import { Checkout } from '../models/checkout.model.js';
import { computeHmacSignature } from '../utils/crypto.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const RETRY_DELAYS_SECONDS = [60, 300, 900, 1800, 3600]; // 1m, 5m, 15m, 30m, 1h

export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository = notificationRepository,
    private readonly appRepo: ApplicationRepository = applicationRepository
  ) {}

  async createNotification(
    payment: Payment,
    eventType: string,
    transaction?: Transaction
  ): Promise<Notification | null> {
    const app = await this.appRepo.findById(payment.applicationId);
    if (!app || !app.webhookUrl) {
      // Not an error — an application may legitimately poll instead — but it is
      // indistinguishable from a misconfiguration at the merchant's end, and
      // silence here looks exactly like a lost webhook when someone comes to
      // ask why their orders never settled. Say so once per event.
      logger.warn(
        { applicationId: payment.applicationId, eventType, paymentId: payment.id },
        'No webhook URL configured for application; merchant will not be notified'
      );
      return null;
    }

    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: {
        paymentId: payment.id,
        reference: payment.reference,
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
        completedAt: payment.completedAt,
        failedAt: payment.failedAt
      }
    };

    return this.enqueue(
      {
        paymentId: payment.id,
        checkoutId: null,
        applicationId: payment.applicationId,
        eventType,
        callbackUrl: app.webhookUrl,
        payload
      },
      app.webhookSecret || '',
      transaction
    );
  }

  /**
   * Queues a merchant webhook for a checkout lifecycle event.
   *
   * A hosted checkout never creates a local `payments` row — pawaPay creates the
   * deposit on its own side — so `createNotification` could not represent these
   * events and merchants heard nothing at all when a hosted checkout completed
   * or failed. The payload deliberately mirrors the payment one: merchants key
   * off `reference` and an uppercase `status`, so an integration written against
   * `payment.*` handles these without changes.
   */
  async createCheckoutNotification(
    checkout: Checkout,
    eventType: string,
    transaction?: Transaction
  ): Promise<Notification | null> {
    const app = await this.appRepo.findById(checkout.applicationId);
    if (!app || !app.webhookUrl) {
      logger.warn(
        { applicationId: checkout.applicationId, eventType, checkoutId: checkout.id },
        'No webhook URL configured for application; merchant will not be notified'
      );
      return null;
    }

    // `amounts` carries one entry per country offered on the checkout; a
    // completed checkout was paid in exactly one of them.
    const settled = checkout.amounts?.[0];

    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: {
        checkoutId: checkout.id,
        providerCheckoutId: checkout.providerCheckoutId,
        // Merchants that already handle `payment.*` read `paymentId` as the
        // provider reference to record against the order.
        paymentId: checkout.depositId || checkout.providerCheckoutId || checkout.id,
        reference: checkout.reference,
        amount: settled ? Number(settled.amount) : null,
        currency: settled?.currency ?? null,
        phoneNumber: checkout.customerPhone,
        country: settled?.country ?? null,
        provider: 'pawapay',
        status: checkout.status,
        depositId: checkout.depositId,
        depositStatus: checkout.depositStatus,
        failureReason: checkout.failureReason,
        customerEmail: checkout.customerEmail,
        customerName: checkout.customerName,
        metadata: checkout.metadata,
        completedAt: checkout.completedAt,
        failedAt: checkout.failedAt,
        expiredAt: checkout.expiredAt
      }
    };

    return this.enqueue(
      {
        paymentId: null,
        checkoutId: checkout.id,
        applicationId: checkout.applicationId,
        eventType,
        callbackUrl: app.webhookUrl,
        payload
      },
      app.webhookSecret || '',
      transaction
    );
  }

  /**
   * Persists the notification and schedules its first delivery attempt.
   *
   * Delivery must not start while the caller's transaction is still open. The
   * row does not exist for anyone else until that transaction commits, and
   * `deliverNotification` reads it back on its own pooled connection — so firing
   * on `setImmediate` ran the delivery *inside* the open transaction, found
   * nothing, and returned early, silently dropping the webhook with no retry.
   * That is why merchants received `payment.processing` (created outside a
   * transaction) but never `payment.completed` (created inside the pawaPay
   * webhook's transaction).
   *
   * `afterCommit` also gives the right behaviour on rollback: the row is gone,
   * so no delivery should happen, and none is scheduled.
   */
  private async enqueue(
    row: {
      paymentId: string | null;
      checkoutId: string | null;
      applicationId: string;
      eventType: string;
      callbackUrl: string;
      payload: Record<string, unknown>;
    },
    webhookSecret: string,
    transaction?: Transaction
  ): Promise<Notification> {
    const notification = await this.repo.create(
      {
        ...row,
        status: NotificationStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: new Date() // immediate first attempt
      },
      transaction
    );

    const scheduleDelivery = () => {
      setImmediate(() => {
        this.deliverNotification(notification.id, webhookSecret).catch((err) => {
          logger.error(
            { err, notificationId: notification.id },
            'Initial notification delivery failed'
          );
        });
      });
    };

    if (transaction) {
      transaction.afterCommit(() => scheduleDelivery());
    } else {
      scheduleDelivery();
    }

    return notification;
  }

  async deliverNotification(notificationId: string, webhookSecret: string): Promise<boolean> {
    const notification = await this.repo.findById(notificationId);
    if (!notification || notification.status === NotificationStatus.DELIVERED) {
      return false;
    }

    const attemptNumber = notification.attemptCount + 1;
    const timestamp = Math.floor(Date.now() / 1000);
    const bodyString = JSON.stringify(notification.payload);
    const signatureHeader = computeHmacSignature(bodyString, webhookSecret, timestamp);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.NOTIFICATION_TIMEOUT_MS);

    try {
      const response = await fetch(notification.callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Signature': signatureHeader,
          'User-Agent': 'PaymentService-Webhooks/1.0'
        },
        body: bodyString,
        signal: controller.signal
      });

      clearTimeout(timeout);
      const responseText = await response.text();

      if (response.ok) {
        await this.repo.update(notification.id, {
          status: NotificationStatus.DELIVERED,
          attemptCount: attemptNumber,
          lastAttemptAt: new Date(),
          nextAttemptAt: null,
          responseStatus: response.status,
          responseBody: responseText.substring(0, 1000)
        });

        logger.info(
          { notificationId: notification.id, applicationId: notification.applicationId },
          'Notification delivered successfully'
        );
        return true;
      }

      // HTTP Error from receiver (4xx, 5xx)
      return await this.handleDeliveryFailure(
        notification,
        attemptNumber,
        response.status,
        responseText.substring(0, 1000)
      );
    } catch (err: unknown) {
      clearTimeout(timeout);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return await this.handleDeliveryFailure(
        notification,
        attemptNumber,
        0,
        errorMessage.substring(0, 1000)
      );
    }
  }

  private async handleDeliveryFailure(
    notification: Notification,
    attemptNumber: number,
    responseStatus: number,
    responseBody: string
  ): Promise<boolean> {
    const maxRetries = env.NOTIFICATION_MAX_RETRIES;
    const isExhausted = attemptNumber >= maxRetries;

    let nextAttemptAt: Date | null = null;
    if (!isExhausted) {
      const delaySeconds =
        RETRY_DELAYS_SECONDS[attemptNumber - 1] ||
        RETRY_DELAYS_SECONDS[RETRY_DELAYS_SECONDS.length - 1] || 3600;
      nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);
    }

    await this.repo.update(notification.id, {
      status: isExhausted ? NotificationStatus.FAILED : NotificationStatus.PENDING,
      attemptCount: attemptNumber,
      lastAttemptAt: new Date(),
      nextAttemptAt,
      responseStatus,
      responseBody
    });

    logger.warn(
      {
        notificationId: notification.id,
        attempt: attemptNumber,
        isExhausted,
        nextAttemptAt
      },
      'Notification delivery attempt failed'
    );

    return false;
  }

  /**
   * Delivers every notification that is currently due.
   *
   * Each notification is isolated: one merchant whose application row cannot be
   * loaded, or whose delivery throws in a way `deliverNotification` does not
   * already absorb, must not abandon the rest of the batch. A single thrown
   * error here used to end the whole sweep, so everything queued behind the bad
   * row waited for the next cycle — and then failed in exactly the same place.
   */
  async processPendingRetries(): Promise<number> {
    const pending = await this.repo.findPendingNotifications(20);
    let successCount = 0;

    for (const notification of pending) {
      try {
        const app = await this.appRepo.findById(notification.applicationId);
        const success = await this.deliverNotification(
          notification.id,
          app?.webhookSecret || ''
        );
        if (success) successCount++;
      } catch (err) {
        logger.error(
          {
            err,
            notificationId: notification.id,
            applicationId: notification.applicationId
          },
          'Notification retry failed; continuing with the rest of the batch'
        );
      }
    }

    return successCount;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
