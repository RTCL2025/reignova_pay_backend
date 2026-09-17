import { Transaction } from 'sequelize';
import { IdempotencyKey } from '../models/idempotency-key.model.js';

export class IdempotencyRepository {
  async findKey(applicationId: string, key: string): Promise<IdempotencyKey | null> {
    return IdempotencyKey.findOne({
      where: {
        applicationId,
        key
      }
    });
  }

  async createLock(
    applicationId: string,
    key: string,
    requestHash: string,
    ttlHours = 24,
    transaction?: Transaction
  ): Promise<IdempotencyKey> {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    return IdempotencyKey.create(
      {
        applicationId,
        key,
        requestHash,
        expiresAt
      },
      { transaction }
    );
  }

  async saveResponse(
    id: string,
    responseStatus: number,
    responseBody: Record<string, unknown>,
    resourceId?: string,
    transaction?: Transaction
  ): Promise<void> {
    await IdempotencyKey.update(
      {
        responseStatus,
        responseBody,
        resourceId
      },
      {
        where: { id },
        transaction
      }
    );
  }

  async deleteKey(id: string, transaction?: Transaction): Promise<void> {
    await IdempotencyKey.destroy({ where: { id }, transaction });
  }
}

export const idempotencyRepository = new IdempotencyRepository();
export default idempotencyRepository;
