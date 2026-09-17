import { Transaction } from 'sequelize';
import { notificationRepository, NotificationRepository } from '../repositories/notification.repository.js';
import { applicationRepository, ApplicationRepository } from '../repositories/application.repository.js';
import { Notification, NotificationStatus } from '../models/notification.model.js';
import { Payment } from '../models/payment.model.js';
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
      // Application has no webhook configured, nothing to notify
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

    const notification = await this.repo.create(
      {
        paymentId: payment.id,
        applicationId: payment.applicationId,
        eventType,
        callbackUrl: app.webhookUrl,
        payload,
        status: NotificationStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: new Date() // immediate first attempt
      },
      transaction
    );

    // Attempt delivery asynchronously in the background
    setImmediate(() => {
      this.deliverNotification(notification.id, app.webhookSecret || '').catch((err) => {
        logger.error({ err, notificationId: notification.id }, 'Initial notification delivery failed');
      });
    });

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

  async processPendingRetries(): Promise<number> {
    const pending = await this.repo.findPendingNotifications(20);
    let successCount = 0;

    for (const notification of pending) {
      const app = await this.appRepo.findById(notification.applicationId);
      const success = await this.deliverNotification(
        notification.id,
        app?.webhookSecret || ''
      );
      if (success) successCount++;
    }

    return successCount;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
