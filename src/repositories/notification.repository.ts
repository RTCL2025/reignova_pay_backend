import { Op, Transaction } from 'sequelize';
import {
  Notification,
  NotificationAttributes,
  NotificationCreationAttributes,
  NotificationStatus
} from '../models/notification.model.js';

export class NotificationRepository {
  async create(
    data: NotificationCreationAttributes,
    transaction?: Transaction
  ): Promise<Notification> {
    return Notification.create(data, { transaction });
  }

  async findById(id: string): Promise<Notification | null> {
    return Notification.findByPk(id);
  }

  async findPendingNotifications(limit = 20): Promise<Notification[]> {
    return Notification.findAll({
      where: {
        status: NotificationStatus.PENDING,
        [Op.or]: [
          { nextAttemptAt: { [Op.is]: null } },
          { nextAttemptAt: { [Op.lte]: new Date() } }
        ]
      },
      limit,
      order: [['nextAttemptAt', 'ASC']]
    });
  }

  async update(
    id: string,
    updates: Partial<NotificationAttributes>,
    transaction?: Transaction
  ): Promise<Notification | null> {
    const notification = await Notification.findByPk(id, { transaction });
    if (!notification) return null;
    return notification.update(updates, { transaction });
  }
}

export const notificationRepository = new NotificationRepository();
export default notificationRepository;
