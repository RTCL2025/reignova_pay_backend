import { describe, it, expect, vi } from 'vitest';
import { IdempotencyService } from '../../../src/services/idempotency.service.js';
import { IdempotencyRepository } from '../../../src/repositories/idempotency.repository.js';
import { ConflictError, IdempotencyError } from '../../../src/utils/errors.js';
import { hashPayload } from '../../../src/utils/crypto.js';

describe('IdempotencyService (Unit)', () => {
  it('executes handler directly when no idempotency key is provided', async () => {
    const service = new IdempotencyService();
    const handler = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: { paymentId: '123' },
      resourceId: '123'
    });

    const result = await service.executeWithIdempotency('app-1', undefined, { amount: 100 }, handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.cached).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ paymentId: '123' });
  });

  it('returns cached response on duplicate request with same payload', async () => {
    const payload = { reference: 'REF-001', amount: 500 };
    const hash = hashPayload(payload);

    const mockRepo: Partial<IdempotencyRepository> = {
      findKey: vi.fn().mockResolvedValue({
        id: 'key-record-1',
        applicationId: 'app-1',
        key: 'test-key-1',
        requestHash: hash,
        responseStatus: 202,
        responseBody: { paymentId: '123', status: 'PROCESSING' },
        expiresAt: new Date(Date.now() + 3600000)
      }),
      createLock: vi.fn(),
      saveResponse: vi.fn(),
      deleteKey: vi.fn()
    };

    const service = new IdempotencyService(mockRepo as IdempotencyRepository);
    const handler = vi.fn();

    const result = await service.executeWithIdempotency('app-1', 'test-key-1', payload, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(result.cached).toBe(true);
    expect(result.statusCode).toBe(202);
    expect(result.body).toEqual({ paymentId: '123', status: 'PROCESSING' });
  });

  it('throws ConflictError on duplicate key with DIFFERENT payload parameters', async () => {
    const originalPayload = { reference: 'REF-001', amount: 500 };
    const hash = hashPayload(originalPayload);

    const mockRepo: Partial<IdempotencyRepository> = {
      findKey: vi.fn().mockResolvedValue({
        id: 'key-record-1',
        applicationId: 'app-1',
        key: 'test-key-1',
        requestHash: hash,
        responseStatus: 202,
        responseBody: { paymentId: '123' },
        expiresAt: new Date(Date.now() + 3600000)
      })
    };

    const service = new IdempotencyService(mockRepo as IdempotencyRepository);
    const differentPayload = { reference: 'REF-002', amount: 999 };

    await expect(
      service.executeWithIdempotency('app-1', 'test-key-1', differentPayload, vi.fn())
    ).rejects.toThrow(ConflictError);
  });

  it('throws IdempotencyError if previous request is still in-flight (responseStatus is null)', async () => {
    const payload = { reference: 'REF-001' };
    const hash = hashPayload(payload);

    const mockRepo: Partial<IdempotencyRepository> = {
      findKey: vi.fn().mockResolvedValue({
        id: 'key-record-1',
        applicationId: 'app-1',
        key: 'test-key-1',
        requestHash: hash,
        responseStatus: null, // Still in progress
        responseBody: null,
        expiresAt: new Date(Date.now() + 3600000)
      })
    };

    const service = new IdempotencyService(mockRepo as IdempotencyRepository);

    await expect(
      service.executeWithIdempotency('app-1', 'test-key-1', payload, vi.fn())
    ).rejects.toThrow(IdempotencyError);
  });
});
