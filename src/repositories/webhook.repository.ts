import { Transaction } from 'sequelize';
import {
  WebhookEvent,
  WebhookEventAttributes,
  WebhookEventCreationAttributes
} from '../models/webhook-event.model.js';

export class WebhookRepository {
  async create(
    data: WebhookEventCreationAttributes,
    transaction?: Transaction
  ): Promise<WebhookEvent> {
    return WebhookEvent.create(data, { transaction });
  }

  async findByEventKey(provider: string, eventKey: string): Promise<WebhookEvent | null> {
    return WebhookEvent.findOne({
      where: {
        provider,
        eventKey
      }
    });
  }

  async update(
    id: string,
    updates: Partial<WebhookEventAttributes>,
    transaction?: Transaction
  ): Promise<WebhookEvent | null> {
    const event = await WebhookEvent.findByPk(id, { transaction });
    if (!event) return null;
    return event.update(updates, { transaction });
  }
}

export const webhookRepository = new WebhookRepository();
export default webhookRepository;
