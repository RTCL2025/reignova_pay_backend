import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export enum WebhookEventStatus {
  RECEIVED = 'RECEIVED',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED'
}

export interface WebhookEventAttributes {
  id: string;
  provider: string;
  eventKey: string;
  eventType: string;
  paymentId?: string | null;
  providerPaymentId?: string | null;
  payload: Record<string, unknown>;
  signature?: string | null;
  status: WebhookEventStatus;
  processedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type WebhookEventCreationAttributes = Optional<
  WebhookEventAttributes,
  | 'id'
  | 'paymentId'
  | 'providerPaymentId'
  | 'signature'
  | 'status'
  | 'processedAt'
  | 'createdAt'
  | 'updatedAt'
>;

export class WebhookEvent
  extends Model<WebhookEventAttributes, WebhookEventCreationAttributes>
  implements WebhookEventAttributes
{
  declare public id: string;
  declare public provider: string;
  declare public eventKey: string;
  declare public eventType: string;
  declare public paymentId: string | null;
  declare public providerPaymentId: string | null;
  declare public payload: Record<string, unknown>;
  declare public signature: string | null;
  declare public status: WebhookEventStatus;
  declare public processedAt: Date | null;
  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;
}

WebhookEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    eventKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'event_key'
    },
    eventType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'event_type'
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
    providerPaymentId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'provider_payment_id'
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    signature: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM(...Object.values(WebhookEventStatus)),
      allowNull: false,
      defaultValue: WebhookEventStatus.RECEIVED
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processed_at'
    }
  },
  {
    sequelize,
    tableName: 'webhook_events',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['provider', 'event_key']
      },
      {
        fields: ['payment_id']
      }
    ]
  }
);

export default WebhookEvent;
