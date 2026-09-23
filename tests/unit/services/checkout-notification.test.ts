import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CheckoutService } from '../../../src/services/checkout.service.js';
import { NotificationService } from '../../../src/services/notification.service.js';
import type { CheckoutRepository } from '../../../src/repositories/checkout.repository.js';
import type { IdempotencyService } from '../../../src/services/idempotency.service.js';
import type { NotificationRepository } from '../../../src/repositories/notification.repository.js';
import type { ApplicationRepository } from '../../../src/repositories/application.repository.js';
import { Checkout, CheckoutStatus } from '../../../src/models/checkout.model.js';
import { NotificationStatus } from '../../../src/models/notification.model.js';

vi.mock('../../../src/services/receipt.service.js', () => ({
  receiptService: { sendReceiptEmail: vi.fn().mockResolvedValue(undefined) }
}));

function fakeCheckout(overrides: Partial<Checkout> = {}): Checkout {
  return {
    id: 'chk-1',
    applicationId: 'app-1',
    reference: 'EVT-TICKET-REV-2026-000012',
    providerCheckoutId: 'cs_sec_abc',
    status: CheckoutStatus.PROCESSING,
    amounts: [{ country: 'TZA', currency: 'TZS', amount: '85000' }],
    customerEmail: 'buyer@example.com',
    customerPhone: '+255754123456',
    customerName: 'Buyer',
    depositId: 'dep-9',
    depositStatus: 'COMPLETED',
    failureReason: null,
    metadata: { orderId: 'ord-1' },
    completedAt: null,
    failedAt: null,
    expiredAt: null,
    update: vi.fn().mockImplementation(async function (this: Checkout, values: Partial<Checkout>) {
      Object.assign(this, values);
      return this;
    }),
    ...overrides
  } as unknown as Checkout;
}

describe('Checkout lifecycle notifications (Unit)', () => {
  let notifications: NotificationService;
  let repo: CheckoutRepository;
  let service: CheckoutService;

  beforeEach(() => {
    notifications = {
      createCheckoutNotification: vi.fn().mockResolvedValue(null)
    } as unknown as NotificationService;

    repo = {} as unknown as CheckoutRepository;

    service = new CheckoutService(
      repo,
      {} as unknown as IdempotencyService,
      notifications
    );
  });

  afterEach(() => vi.clearAllMocks());

  /**
   * The gap this guards against: a hosted checkout never creates a local
   * payment row, so the payment notification path could not fire, and
   * `transitionCheckoutStatus` emitted nothing of its own. Merchants therefore
   * received no webhook whatsoever for a hosted checkout — the events backend
   * only ever learned an order was paid because the buyer's browser happened to
   * come back to the callback page.
   */
  it('notifies the merchant when a checkout completes', async () => {
    const checkout = fakeCheckout();

    await service.transitionCheckoutStatus(checkout, CheckoutStatus.COMPLETED);

    expect(notifications.createCheckoutNotification).toHaveBeenCalledWith(
      checkout,
      'checkout.completed',
      undefined
    );
  });

  it('notifies the merchant when a checkout fails', async () => {
    const checkout = fakeCheckout();

    await service.transitionCheckoutStatus(checkout, CheckoutStatus.FAILED, 'payer cancelled');

    expect(notifications.createCheckoutNotification).toHaveBeenCalledWith(
      checkout,
      'checkout.failed',
      undefined
    );
  });

  it('notifies the merchant when a checkout expires so reserved stock is released', async () => {
    const checkout = fakeCheckout();

    await service.transitionCheckoutStatus(checkout, CheckoutStatus.EXPIRED);

    expect(notifications.createCheckoutNotification).toHaveBeenCalledWith(
      checkout,
      'checkout.expired',
      undefined
    );
  });

  it('passes the caller transaction through so the row commits atomically', async () => {
    const checkout = fakeCheckout();
    const transaction = { afterCommit: vi.fn() } as never;

    await service.transitionCheckoutStatus(
      checkout,
      CheckoutStatus.COMPLETED,
      undefined,
      undefined,
      transaction
    );

    expect(notifications.createCheckoutNotification).toHaveBeenCalledWith(
      checkout,
      'checkout.completed',
      transaction
    );
  });

  it('does not notify when the status has not actually changed', async () => {
    const checkout = fakeCheckout({ status: CheckoutStatus.COMPLETED });

    await service.transitionCheckoutStatus(checkout, CheckoutStatus.COMPLETED);

    expect(notifications.createCheckoutNotification).not.toHaveBeenCalled();
  });

  /**
   * A failed notification must never roll back a state change that pawaPay has
   * already told us about — the sweeper exists to retry the delivery.
   */
  it('still completes the transition if enqueuing the notification throws', async () => {
    const checkout = fakeCheckout();
    notifications.createCheckoutNotification = vi
      .fn()
      .mockRejectedValue(new Error('notifications table unavailable'));

    await expect(
      service.transitionCheckoutStatus(checkout, CheckoutStatus.COMPLETED)
    ).resolves.toBeDefined();
    expect(checkout.status).toBe(CheckoutStatus.COMPLETED);
  });
});

describe('NotificationService.createCheckoutNotification (Unit)', () => {
  let repo: NotificationRepository;
  let appRepo: ApplicationRepository;
  let service: NotificationService;

  beforeEach(() => {
    repo = {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
      findById: vi.fn().mockResolvedValue(null),
      findPendingNotifications: vi.fn().mockResolvedValue([]),
      update: vi.fn()
    } as unknown as NotificationRepository;

    appRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'app-1',
        webhookUrl: 'https://merchant.example/api/v1/webhooks/payments',
        webhookSecret: 'whsec_test'
      })
    } as unknown as ApplicationRepository;

    service = new NotificationService(repo, appRepo);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('scopes the row to the checkout, not a payment', async () => {
    await service.createCheckoutNotification(fakeCheckout(), 'checkout.completed');

    const row = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(row.checkoutId).toBe('chk-1');
    expect(row.paymentId).toBeNull();
    expect(row.status).toBe(NotificationStatus.PENDING);
  });

  /**
   * Merchants key off `reference` and `status`; the events backend in
   * particular resolves the order from `reference` and treats an uppercase
   * COMPLETED as payment success.
   */
  it('emits a payload the merchant can act on', async () => {
    // `transitionCheckoutStatus` persists the new status before enqueuing, so
    // the payload reports the row's own state rather than the event name.
    const checkout = fakeCheckout({
      status: CheckoutStatus.COMPLETED,
      completedAt: new Date()
    });

    await service.createCheckoutNotification(checkout, 'checkout.completed');

    const row = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(row.payload).toMatchObject({
      event: 'checkout.completed',
      data: {
        reference: 'EVT-TICKET-REV-2026-000012',
        status: 'COMPLETED',
        amount: 85000,
        currency: 'TZS',
        checkoutId: 'chk-1'
      }
    });
  });

  it('reports FAILED status for a failed checkout', async () => {
    const checkout = fakeCheckout({ status: CheckoutStatus.FAILED, failureReason: 'payer cancelled' });

    await service.createCheckoutNotification(checkout, 'checkout.failed');

    const row = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(row.payload.data).toMatchObject({
      status: 'FAILED',
      failureReason: 'payer cancelled'
    });
  });

  it('skips applications with no webhook configured', async () => {
    (appRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'app-1',
      webhookUrl: null
    });

    const result = await service.createCheckoutNotification(fakeCheckout(), 'checkout.completed');

    expect(result).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
  });
});
