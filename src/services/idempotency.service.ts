import { idempotencyRepository, IdempotencyRepository } from '../repositories/idempotency.repository.js';
import { hashPayload } from '../utils/crypto.js';
import { ConflictError, IdempotencyError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

export interface CachedResponse<T = unknown> {
  statusCode: number;
  body: T;
  cached: boolean;
}

export class IdempotencyService {
  constructor(private readonly repo: IdempotencyRepository = idempotencyRepository) {}

  async executeWithIdempotency<T extends object>(
    applicationId: string,
    key: string | undefined,
    requestPayload: unknown,
    handler: () => Promise<{ statusCode: number; body: T; resourceId?: string }>
  ): Promise<CachedResponse<T>> {
    // If client did not provide idempotency key, execute directly
    if (!key || key.trim() === '') {
      const result = await handler();
      return { statusCode: result.statusCode, body: result.body, cached: false };
    }

    const currentHash = hashPayload(requestPayload);
    const existing = await this.repo.findKey(applicationId, key);

    if (existing) {
      // Check if expired
      if (existing.expiresAt.getTime() <= Date.now()) {
        await this.repo.deleteKey(existing.id);
      } else {
        // Check if concurrent request is still processing
        if (existing.responseStatus === null || existing.responseStatus === undefined) {
          throw new IdempotencyError('A request with this Idempotency-Key is currently processing');
        }

        // Check if payload matches previous request
        if (existing.requestHash !== currentHash) {
          throw new ConflictError(
            'Idempotency key was previously used with different request parameters'
          );
        }

        // Return cached response
        logger.info(
          { applicationId, key, resourceId: existing.resourceId },
          'Returning cached response for idempotent request'
        );

        return {
          statusCode: existing.responseStatus,
          body: existing.responseBody as T,
          cached: true
        };
      }
    }

    // Acquire lock by creating key
    let lockRecord;
    try {
      lockRecord = await this.repo.createLock(applicationId, key, currentHash);
    } catch {
      // Handle race condition where another request created the key simultaneously
      const record = await this.repo.findKey(applicationId, key);
      if (record && record.responseStatus !== null) {
        if (record.requestHash === currentHash) {
          return {
            statusCode: record.responseStatus,
            body: record.responseBody as T,
            cached: true
          };
        }
        throw new ConflictError(
          'Idempotency key was previously used with different request parameters'
        );
      }
      throw new IdempotencyError('A request with this Idempotency-Key is currently processing');
    }

    try {
      const result = await handler();
      await this.repo.saveResponse(
        lockRecord.id,
        result.statusCode,
        result.body as unknown as Record<string, unknown>,
        result.resourceId
      );
      return { statusCode: result.statusCode, body: result.body, cached: false };
    } catch (error) {
      // Clean up the lock on unhandled failure so client can retry
      await this.repo.deleteKey(lockRecord.id).catch((delErr) => {
        logger.error({ delErr }, 'Failed to delete idempotency lock after error');
      });
      throw error;
    }
  }
}

export const idempotencyService = new IdempotencyService();
export default idempotencyService;
