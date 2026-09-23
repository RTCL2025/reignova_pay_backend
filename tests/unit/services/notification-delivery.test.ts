import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationService } from '../../../src/services/notification.service.js';
import type { NotificationRepository } from '../../../src/repositories/notification.repository.js';
import type { ApplicationRepository } from '../../../src/repositories/application.repository.js';
import { NotificationStatus } from '../../../src/models/notification.model.js';
import type { Payment } from '../../../src/models/payment.model.js';
import type { Transaction } from 'sequelize';

/**
 * A stand-in for a Sequelize managed transaction that records `afterCommit`
 * hooks so a test can assert what runs before the commit and what runs after.
 */
function fakeTransaction() {
  const hooks: Array<(t: unknown) => unknown> = [];
  const transaction = {
    afterCommit: (fn: (t: unknown) => unknown) => {
      hooks.push(fn);
    }
  } as unknown as Transaction;

  return {
    transaction,
    hookCount: () => hooks.length,
    async commit() {
      for (const hook of hooks) {
        await hook(transaction);
      }
    }
  };
}

/** Lets pending `setImmediate` callbacks run so the old behaviour is observable. */
const flushMacrotasks = () => new Promise((resolve) => setImmediate(resolve));

const payment = {
  id: 'pay-1',
  applicationId: 'app-1',
  reference: 'EVT-TICKET-REV-2026-000012',
  amount: 85000,
  currency: 'TZS',
  phoneNumber: '+255754123456',
  country: 'TZA',
  provider: 'pawapay',
  providerPaymentId: 'dep-1',
  status: 'COMPLETED',
  failureReason: null,
  description: 'Tickets',
  metadata: {},
  completedAt: new Date(),
  failedAt: null
} as unknown as Payment;

describe('NotificationService delivery scheduling (Unit)', () => {
  let repo: NotificationRepository;
  let appRepo: ApplicationRepository;
  let service: NotificationService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'ok'
    });
    vi.stubGlobal('fetch', fetchMock);

    repo = {
      create: vi.fn().mockResolvedValue({
        id: 'notif-1',
        applicationId: 'app-1',
        callbackUrl: 'https://merchant.example/api/v1/webhooks/payments',
        payload: { event: 'payment.completed' },
        status: NotificationStatus.PENDING,
        attemptCount: 0
      }),
      // Mirrors the real repository: the read runs on its own connection and
      // therefore cannot see a row that is still inside an open transaction.
      findById: vi.fn().mockResolvedValue(null),
      findPendingNotifications: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(null)
    } as unknown as NotificationRepository;

    appRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'app-1',
        webhookUrl: 'https://merchant.example/api/v1/webhooks/payments',
        webhookSecret: 'whsec_test'
      })
    } as unknown as ApplicationRepository;

    service = new NotificationService(repo, appRepo);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  /**
   * The bug this guards against: `transitionStatus` creates the notification row
   * inside the webhook's transaction, but delivery was scheduled with
   * `setImmediate`, which fires while that transaction is still open. The delivery
   * read then missed the uncommitted row, returned early, and the webhook was
   * dropped with no retry — which is why merchants saw `payment.processing`
   * (created outside a transaction) but never `payment.completed`.
   */
  it('does not attempt delivery while the creating transaction is still open', async () => {
    const tx = fakeTransaction();

    await service.createNotification(payment, 'payment.completed', tx.transaction);
    await flushMacrotasks();

    expect(repo.findById).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('delivers once the creating transaction commits', async () => {
    const tx = fakeTransaction();
    // Once committed the row is visible to any connection.
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'notif-1',
      applicationId: 'app-1',
      callbackUrl: 'https://merchant.example/api/v1/webhooks/payments',
      payload: { event: 'payment.completed' },
      status: NotificationStatus.PENDING,
      attemptCount: 0
    });

    await service.createNotification(payment, 'payment.completed', tx.transaction);
    expect(tx.hookCount()).toBe(1);

    await tx.commit();
    await flushMacrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://merchant.example/api/v1/webhooks/payments');
    expect((init as RequestInit).headers).toMatchObject({
      'X-Payment-Signature': expect.stringContaining('t=')
    });
  });

  it('still delivers immediately when no transaction is involved', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'notif-1',
      applicationId: 'app-1',
      callbackUrl: 'https://merchant.example/api/v1/webhooks/payments',
      payload: { event: 'payment.processing' },
      status: NotificationStatus.PENDING,
      attemptCount: 0
    });

    await service.createNotification(payment, 'payment.processing');
    await flushMacrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * A row that is created but never delivered must stay claimable by the retry
   * sweeper, otherwise a single missed delivery is lost forever.
   */
  it('leaves an undelivered notification PENDING with a due retry time', async () => {
    const tx = fakeTransaction();

    await service.createNotification(payment, 'payment.completed', tx.transaction);

    const created = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(created.status).toBe(NotificationStatus.PENDING);
    expect(created.nextAttemptAt).toBeInstanceOf(Date);
  });
});
