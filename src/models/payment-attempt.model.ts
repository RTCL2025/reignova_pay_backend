import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export interface PaymentAttemptAttributes {
  id: string;
  paymentId: string;
  attemptNumber: number;
  provider: string;
  providerRequestId?: string | null;
  status: string;
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PaymentAttemptCreationAttributes = Optional<
  PaymentAttemptAttributes,
  | 'id'
  | 'attemptNumber'
  | 'providerRequestId'
  | 'requestPayload'
  | 'responsePayload'
  | 'errorCode'
  | 'errorMessage'
  | 'createdAt'
  | 'updatedAt'
>;

export class PaymentAttempt
  extends Model<PaymentAttemptAttributes, PaymentAttemptCreationAttributes>
  implements PaymentAttemptAttributes
{
  declare public id: string;
  declare public paymentId: string;
  declare public attemptNumber: number;
  declare public provider: string;
  declare public providerRequestId: string | null;
  declare public status: string;
  declare public requestPayload: Record<string, unknown> | null;
  declare public responsePayload: Record<string, unknown> | null;
  declare public errorCode: string | null;
  declare public errorMessage: string | null;
  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;
}

PaymentAttempt.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    paymentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'payment_id',
      references: {
        model: 'payments',
        key: 'id'
      }
    },
    attemptNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'attempt_number'
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    providerRequestId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'provider_request_id'
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    requestPayload: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'request_payload'
    },
    responsePayload: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'response_payload'
    },
    errorCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'error_code'
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message'
    }
  },
  {
    sequelize,
    tableName: 'payment_attempts',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['payment_id']
      }
    ]
  }
);

export default PaymentAttempt;
