import { checkoutRepository, CheckoutRepository } from '../repositories/checkout.repository.js';
import { checkoutService, CheckoutService } from './checkout.service.js';
import { getPaymentProvider } from './payment.service.js';
import { PawapayMapper } from '../integrations/pawapay/pawapay.mapper.js';
import { CheckoutStatus } from '../models/checkout.model.js';
import { logger } from '../config/logger.js';

/**
 * Checkout Reconciliation Service
 *
 * Implements the pawaPay v2 recommended reconciliation cycle.
 * Periodically checks the status of non-final checkouts against the pawaPay API
 * to catch any missed callbacks due to network issues, downtime, or config errors.
 *
 * Per docs: "To avoid keeping your customers waiting, we strongly recommend
 * implementing a status recheck cycle."
 */
export class CheckoutReconciliationService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  /** How often to run the reconciliation cycle (in ms). Default: 5 minutes. */
  private readonly POLL_INTERVAL_MS: number;

  /** Only reconcile checkouts older than this many minutes. Default: 15 minutes. */
  private readonly STALE_THRESHOLD_MINUTES: number;

  /** Maximum checkouts to process per cycle. Default: 50. */
  private readonly BATCH_SIZE: number;

  constructor(
    private readonly repo: CheckoutRepository = checkoutRepository,
    private readonly checkouts: CheckoutService = checkoutService,
    options?: {
      pollIntervalMs?: number;
      staleThresholdMinutes?: number;
      batchSize?: number;
    }
  ) {
    this.POLL_INTERVAL_MS = options?.pollIntervalMs ?? 5 * 60 * 1000;
    this.STALE_THRESHOLD_MINUTES = options?.staleThresholdMinutes ?? 15;
    this.BATCH_SIZE = options?.batchSize ?? 50;
  }

  /**
   * Starts the reconciliation cycle on a fixed interval.
   * Safe to call multiple times — will not create duplicate intervals.
   */
  start(): void {
    if (this.intervalHandle) {
      logger.warn('Checkout reconciliation is already running');
      return;
    }

    logger.info(
      {
        pollIntervalMs: this.POLL_INTERVAL_MS,
        staleThresholdMinutes: this.STALE_THRESHOLD_MINUTES,
        batchSize: this.BATCH_SIZE
      },
      'Starting checkout reconciliation cycle'
    );

    // Run immediately on startup, then on interval
    this.runCycle().catch((err) => {
      logger.error({ err }, 'Initial checkout reconciliation cycle failed');
    });

    this.intervalHandle = setInterval(() => {
      this.runCycle().catch((err) => {
        logger.error({ err }, 'Checkout reconciliation cycle failed');
      });
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Stops the reconciliation cycle.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('Checkout reconciliation cycle stopped');
    }
  }

  /**
   * Runs a single reconciliation cycle.
   *
   * For each pending checkout older than the threshold:
   * 1. Query pawaPay for the current checkout status
   * 2. If the checkout has reached a final status, transition our local record
   * 3. If the checkout is NOT_FOUND on pawaPay, it was never accepted — mark as FAILED
   * 4. If still in progress, leave it for the next cycle
   */
  async runCycle(): Promise<{ checked: number; updated: number; errors: number }> {
    const pendingCheckouts = await this.repo.findPendingForReconciliation(
      this.STALE_THRESHOLD_MINUTES,
      this.BATCH_SIZE
    );

    if (pendingCheckouts.length === 0) {
      return { checked: 0, updated: 0, errors: 0 };
    }

    logger.info(
      { count: pendingCheckouts.length },
      'Reconciliation cycle: checking stale checkouts'
    );

    const provider = getPaymentProvider();
    let updated = 0;
    let errors = 0;

    for (const checkout of pendingCheckouts) {
      try {
        // Use the providerCheckoutId (which is the pawaPay checkoutId) to check status
        const checkoutIdToQuery = checkout.providerCheckoutId || checkout.id;
        const providerStatus = await provider.checkCheckoutStatus(checkoutIdToQuery);

        // Determine the target status
        const targetStatus = PawapayMapper.toCheckoutStatus(providerStatus.status);

        // Only transition if the status has actually changed
        if (targetStatus !== checkout.status) {
          let failureReason: string | undefined;

          // For terminal failure states, extract failure info
          if (targetStatus === CheckoutStatus.FAILED) {
            failureReason = 'Reconciliation: checkout failed (detected via status poll)';
          } else if (targetStatus === CheckoutStatus.EXPIRED) {
            failureReason = undefined; // Expiry is not a failure per se
          }

          await this.checkouts.transitionCheckoutStatus(
            checkout,
            targetStatus,
            failureReason,
            {
              depositId: providerStatus.depositId,
              depositStatus: providerStatus.depositStatus,
              depositsHistory: providerStatus.depositsHistory as Array<Record<string, unknown>> | undefined
            }
          );

          updated++;
          logger.info(
            {
              checkoutId: checkout.id,
              fromStatus: checkout.status,
              toStatus: targetStatus,
              providerCheckoutId: checkoutIdToQuery
            },
            'Reconciliation: checkout status updated'
          );
        }
      } catch (err) {
        errors++;
        logger.error(
          { err, checkoutId: checkout.id },
          'Reconciliation: error checking checkout status'
        );
      }
    }

    logger.info(
      { checked: pendingCheckouts.length, updated, errors },
      'Reconciliation cycle complete'
    );

    return { checked: pendingCheckouts.length, updated, errors };
  }
}

export const checkoutReconciliationService = new CheckoutReconciliationService();
export default checkoutReconciliationService;
