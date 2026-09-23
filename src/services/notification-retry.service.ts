import { notificationService, NotificationService } from './notification.service.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Notification Retry Sweeper
 *
 * `NotificationService` has always carried a retry ladder — five attempts backing
 * off 1m, 5m, 15m, 30m, 1h — but nothing ever called `processPendingRetries`, so
 * the ladder was dead code. A merchant webhook that failed its first delivery
 * attempt stayed PENDING forever and the merchant never learned the payment had
 * completed.
 *
 * This sweeper is the safety net behind the immediate `afterCommit` delivery: any
 * notification that was never delivered, whatever the reason — the merchant was
 * down, the container was asleep, the process was redeployed mid-flight — is
 * picked up here and retried until it succeeds or exhausts its attempts.
 *
 * Mirrors `CheckoutReconciliationService`, which does the same job one hop
 * upstream for pawaPay callbacks that never reached us.
 */
export class NotificationRetryService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  /** Guards against overlapping cycles — see `runCycle`. */
  private cycleInFlight = false;

  private readonly POLL_INTERVAL_MS: number;

  constructor(
    private readonly notifications: NotificationService = notificationService,
    options?: { pollIntervalMs?: number }
  ) {
    this.POLL_INTERVAL_MS = options?.pollIntervalMs ?? env.NOTIFICATION_POLL_INTERVAL_MS;
  }

  /**
   * Starts the sweep loop. Safe to call more than once; the second call is a
   * no-op rather than a second interval.
   */
  start(): void {
    if (this.intervalHandle) {
      logger.warn('Notification retry sweeper is already running');
      return;
    }

    logger.info(
      { pollIntervalMs: this.POLL_INTERVAL_MS },
      'Starting notification retry sweeper'
    );

    // Sweep immediately as well as on the interval: a restart or a cold start
    // should drain whatever built up while the process was gone.
    void this.safeCycle();

    this.intervalHandle = setInterval(() => {
      void this.safeCycle();
    }, this.POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('Notification retry sweeper stopped');
    }
  }

  /** Runs a cycle, swallowing errors so one bad sweep never kills the loop. */
  private async safeCycle(): Promise<void> {
    try {
      await this.runCycle();
    } catch (err) {
      logger.error({ err }, 'Notification retry cycle failed');
    }
  }

  /**
   * Delivers every notification that is due.
   *
   * A cycle can outlast its own interval — a batch of twenty, each allowed a ten
   * second HTTP timeout, is well past the thirty second default — so an
   * in-flight guard keeps two cycles from claiming the same rows and delivering
   * a merchant the same event twice.
   */
  async runCycle(): Promise<{ delivered: number; skipped: boolean }> {
    if (this.cycleInFlight) {
      logger.debug('Notification retry cycle still in flight; skipping this tick');
      return { delivered: 0, skipped: true };
    }

    this.cycleInFlight = true;
    try {
      const delivered = await this.notifications.processPendingRetries();

      if (delivered > 0) {
        logger.info({ delivered }, 'Notification retry cycle delivered pending webhooks');
      }

      return { delivered, skipped: false };
    } finally {
      this.cycleInFlight = false;
    }
  }
}

export const notificationRetryService = new NotificationRetryService();
export default notificationRetryService;
