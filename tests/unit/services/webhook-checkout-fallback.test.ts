import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookService } from '../../../src/services/webhook.service.js';
import type { WebhookRepository } from '../../../src/repositories/webhook.repository.js';
import type { PaymentRepository } from '../../../src/repositories/payment.repository.js';
import type { CheckoutRepository } from '../../../src/repositories/checkout.repository.js';
import type { CheckoutService } from '../../../src/services/checkout.service.js';
import type { PaymentService } from '../../../src/services/payment.service.js';
import type { PawapaySignatureVerifier } from '../../../src/integrations/pawapay/pawapay.signature.js';
import { CheckoutStatus } from '../../../src/models/checkout.model.js';
import { WebhookEventStatus } from '../../../src/models/webhook-event.model.js';

/**
 * A hosted checkout never creates a local `payments` row — pawaPay owns the
 * deposit — so when pawaPay posted the deposit callback, both payment lookups
 * missed, the handler logged "Payment not found", marked the webhook FAILED and
 * returned 200. The callback was acknowledged and thrown away: pawaPay saw
 * success and never retried, and the merchant was never told the money arrived.
 *
 * The deposit belongs to a checkout we do know about, so resolve it that way
 * before giving up.
 */
describe('Deposit callback fallback to checkout (Unit)', () => {
  let repo: WebhookRepository;
  let paymentRepo: PaymentRepository;
  let checkoutRepo: CheckoutRepository;
  let checkouts: CheckoutService;
  let service: WebhookService;

  const checkout = {
    id: 'chk-1',
    applicationId: 'app-1',
    reference: 'EVT-TICKET-REV-2026-000012',
    status: CheckoutStatus.PROCESSING
  } as never;

  beforeEach(() => {
    repo = {
      findByEventKey: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
      update: vi.fn().mockResolvedValue(null)
    } as unknown as WebhookRepository;

    paymentRepo = {
      findByPk: vi.fn().mockResolvedValue(null),
      findByProviderPaymentId: vi.fn().mockResolvedValue(null)
    } as unknown as PaymentRepository;

    checkoutRepo = {
      findByDepositId: vi.fn().mockResolvedValue(checkout)
    } as unknown as CheckoutRepository;

    checkouts = {
      transitionCheckoutStatus: vi.fn().mockResolvedValue(checkout)
    } as unknown as CheckoutService;

    service = new WebhookService(
      repo,
      paymentRepo,
      checkoutRepo,
      {} as unknown as PaymentService,
      checkouts,
      { verifySignature: vi.fn().mockResolvedValue(true) } as unknown as PawapaySignatureVerifier
    );
  });

  it('completes the linked checkout when the deposit has no local payment', async () => {
    const result = await service.processPawapayCallback(
      {},
      { depositId: 'dep-9', status: 'COMPLETED' } as never
    );

    expect(checkoutRepo.findByDepositId).toHaveBeenCalledWith('dep-9');
    expect(checkouts.transitionCheckoutStatus).toHaveBeenCalledWith(
      checkout,
      CheckoutStatus.COMPLETED,
      undefined,
      expect.objectContaining({ depositId: 'dep-9', depositStatus: 'COMPLETED' })
    );
    expect(result.acknowledged).toBe(true);
    expect(result.checkoutId).toBe('chk-1');
  });

  it('fails the linked checkout when the deposit failed', async () => {
    await service.processPawapayCallback(
      {},
      {
        depositId: 'dep-9',
        status: 'FAILED',
        failureReason: { failureMessage: 'insufficient balance' }
      } as never
    );

    expect(checkouts.transitionCheckoutStatus).toHaveBeenCalledWith(
      checkout,
      CheckoutStatus.FAILED,
      'insufficient balance',
      expect.anything()
    );
  });

  it('marks the webhook processed rather than failed once the checkout is resolved', async () => {
    await service.processPawapayCallback(
      {},
      { depositId: 'dep-9', status: 'COMPLETED' } as never
    );

    expect(repo.update).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ status: WebhookEventStatus.PROCESSED })
    );
  });

  /**
   * With neither a payment nor a checkout there is genuinely nothing to act on,
   * and the existing behaviour — record the failure and acknowledge so pawaPay
   * stops retrying an unknown id — is still correct.
   */
  it('still gives up when no checkout matches either', async () => {
    (checkoutRepo.findByDepositId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await service.processPawapayCallback(
      {},
      { depositId: 'dep-unknown', status: 'COMPLETED' } as never
    );

    expect(checkouts.transitionCheckoutStatus).not.toHaveBeenCalled();
    expect(result.acknowledged).toBe(true);
    expect(repo.update).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ status: WebhookEventStatus.FAILED })
    );
  });
});
