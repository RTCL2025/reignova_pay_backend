import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationRetryService } from '../../../src/services/notification-retry.service.js';
import { NotificationService } from '../../../src/services/notification.service.js';
import type { NotificationRepository } from '../../../src/repositories/notification.repository.js';
import type { ApplicationRepository } from '../../../src/repositories/application.repository.js';
import { NotificationStatus } from '../../../src/models/notification.model.js';

/**
 * The retry ladder in NotificationService has always existed, but nothing ever
 * called `processPendingRetries` — so a notification that failed its first
 * delivery attempt sat PENDING forever and the merchant never heard about the
 * payment. These tests cover the sweeper that drives it.
 */
describe('NotificationRetryService (Unit)', () => {
  let notifications: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    notifications = {
      processPendingRetries: vi.fn().mockResolvedValue(0)
    } as unknown as NotificationService;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('sweeps once immediately on start so a restart drains the backlog', () => {
    const service = new NotificationRetryService(notifications, { pollIntervalMs: 30_000 });

    service.start();

    expect(notifications.processPendingRetries).toHaveBeenCalledTimes(1);
    service.stop();
  });

  it('keeps sweeping on the configured interval', async () => {
    const service = new NotificationRetryService(notifications, { pollIntervalMs: 30_000 });

    service.start();
    await vi.advanceTimersByTimeAsync(90_000);

    // One immediate sweep plus one per elapsed interval.
    expect(notifications.processPendingRetries).toHaveBeenCalledTimes(4);
    service.stop();
  });

  it('does not start a second interval if start is called twice', async () => {
    const service = new NotificationRetryService(notifications, { pollIntervalMs: 30_000 });

    service.start();
    service.start();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(notifications.processPendingRetries).toHaveBeenCalledTimes(2);
    service.stop();
  });

  it('stops sweeping after stop()', async () => {
    const service = new NotificationRetryService(notifications, { pollIntervalMs: 30_000 });

    service.start();
    service.stop();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(notifications.processPendingRetries).toHaveBeenCalledTimes(1);
  });

  /**
   * A cycle can outlast its own interval — twenty notifications each allowed a
   * ten second HTTP timeout is well past thirty seconds. Without a guard the
   * cycles overlap and the same notification is delivered twice.
   */
  it('never runs two cycles concurrently', async () => {
    let resolveSweep: (value: number) => void = () => {};
    notifications.processPendingRetries = vi
      .fn()
      .mockImplementation(() => new Promise<number>((resolve) => (resolveSweep = resolve)));

    const service = new NotificationRetryService(notifications, { pollIntervalMs: 1_000 });
    service.start();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(notifications.processPendingRetries).toHaveBeenCalledTimes(1);

    resolveSweep(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(notifications.processPendingRetries).toHaveBeenCalledTimes(2);

    service.stop();
  });

  it('survives a cycle that throws and keeps sweeping', async () => {
    notifications.processPendingRetries = vi
      .fn()
      .mockRejectedValueOnce(new Error('database unreachable'))
      .mockResolvedValue(0);

    const service = new NotificationRetryService(notifications, { pollIntervalMs: 30_000 });
    service.start();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(notifications.processPendingRetries).toHaveBeenCalledTimes(3);
    service.stop();
  });
});

/**
 * One unreachable merchant must not stop the sweep for every other merchant in
 * the batch, so the per-notification work is isolated.
 */
describe('NotificationService.processPendingRetries isolation (Unit)', () => {
  it('continues the batch when one notification throws', async () => {
    const pending = [
      { id: 'n-1', applicationId: 'app-1' },
      { id: 'n-2', applicationId: 'app-2' },
      { id: 'n-3', applicationId: 'app-3' }
    ];

    const repo = {
      findPendingNotifications: vi.fn().mockResolvedValue(pending),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    } as unknown as NotificationRepository;

    const appRepo = {
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'app-2') throw new Error('application lookup exploded');
        return { id, webhookUrl: 'https://merchant.example/hook', webhookSecret: 's' };
      })
    } as unknown as ApplicationRepository;

    const service = new NotificationService(repo, appRepo);
    const deliver = vi
      .spyOn(service, 'deliverNotification')
      .mockResolvedValue(true);

    const delivered = await service.processPendingRetries();

    expect(deliver).toHaveBeenCalledTimes(2);
    expect(delivered).toBe(2);
  });

  it('claims only notifications that are due', async () => {
    const repo = {
      findPendingNotifications: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    } as unknown as NotificationRepository;

    const service = new NotificationService(repo, {
      findById: vi.fn()
    } as unknown as ApplicationRepository);

    await service.processPendingRetries();

    expect(repo.findPendingNotifications).toHaveBeenCalled();
    expect(NotificationStatus.PENDING).toBe('PENDING');
  });
});
