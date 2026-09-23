import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export enum NotificationStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED'
}

export interface NotificationAttributes {
  id: string;
  /**
   * Exactly one of `paymentId` / `checkoutId` is set. Hosted checkouts never
   * create a local payment row, so checkout lifecycle events are scoped to the
   * checkout instead. A database CHECK constraint enforces the pairing.
   */
  paymentId: string | null;
  checkoutId: string | null;
  applicationId: string;
  eventType: string;
  callbackUrl: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  attemptCount: number;
  lastAttemptAt?: Date | null;
  nextAttemptAt?: Date | null;
  responseStatus?: number | null;
  responseBody?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type NotificationCreationAttributes = Optional<
  NotificationAttributes,
  | 'id'
  | 'paymentId'
  | 'checkoutId'
  | 'status'
  | 'attemptCount'
  | 'lastAttemptAt'
  | 'nextAttemptAt'
  | 'responseStatus'
  | 'responseBody'
  | 'createdAt'
  | 'updatedAt'
>;

export class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes
{
  declare public id: string;
  declare public paymentId: string | null;
  declare public checkoutId: string | null;
  declare public applicationId: string;
  declare public eventType: string;
  declare public callbackUrl: string;
  declare public payload: Record<string, unknown>;
  declare public status: NotificationStatus;
  declare public attemptCount: number;
  declare public lastAttemptAt: Date | null;
  declare public nextAttemptAt: Date | null;
  declare public responseStatus: number | null;
  declare public responseBody: string | null;
  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;
}

Notification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    paymentId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'payment_id',
      references: {
        model: 'payments',
        key: 'id'
      }
    },
    checkoutId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'checkout_id',
      references: {
        model: 'checkouts',
        key: 'id'
      }
    },
    applicationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'application_id',
      references: {
        model: 'applications',
        key: 'id'
      }
    },
    eventType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'event_type'
    },
    callbackUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'callback_url'
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(...Object.values(NotificationStatus)),
      allowNull: false,
      defaultValue: NotificationStatus.PENDING
    },
    attemptCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'attempt_count'
    },
    lastAttemptAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_attempt_at'
    },
    nextAttemptAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'next_attempt_at'
    },
    responseStatus: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'response_status'
    },
    responseBody: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'response_body'
    }
  },
  {
    sequelize,
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['status']
      },
      {
        fields: ['next_attempt_at']
      },
      {
        fields: ['application_id']
      },
      {
        fields: ['payment_id']
      }
    ]
  }
);

export default Notification;
