import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export enum PaymentType {
  DEPOSIT = 'DEPOSIT',
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND'
}

export interface PaymentAttributes {
  id: string;
  applicationId: string;
  reference: string;
  type: PaymentType;
  amount: number;
  currency: string;
  phoneNumber: string;
  country: string;
  provider?: string | null;
  providerPaymentId?: string | null;
  status: PaymentStatus;
  failureReason?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  originalPaymentId?: string | null;
  customerMessage?: string | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PaymentCreationAttributes = Optional<
  PaymentAttributes,
  | 'id'
  | 'type'
  | 'status'
  | 'provider'
  | 'providerPaymentId'
  | 'failureReason'
  | 'description'
  | 'metadata'
  | 'originalPaymentId'
  | 'customerMessage'
  | 'completedAt'
  | 'failedAt'
  | 'createdAt'
  | 'updatedAt'
>;

export class Payment
  extends Model<PaymentAttributes, PaymentCreationAttributes>
  implements PaymentAttributes
{
  declare public id: string;
  declare public applicationId: string;
  declare public reference: string;
  declare public type: PaymentType;
  declare public amount: number;
  declare public currency: string;
  declare public phoneNumber: string;
  declare public country: string;
  declare public provider: string | null;
  declare public providerPaymentId: string | null;
  declare public status: PaymentStatus;
  declare public failureReason: string | null;
  declare public description: string | null;
  declare public metadata: Record<string, unknown> | null;
  declare public originalPaymentId: string | null;
  declare public customerMessage: string | null;
  declare public completedAt: Date | null;
  declare public failedAt: Date | null;
  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;
}

Payment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
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
    reference: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM(...Object.values(PaymentType)),
      allowNull: false,
      defaultValue: PaymentType.DEPOSIT
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue('amount');
        return val === null ? null : parseFloat(val as unknown as string);
      }
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false
    },
    phoneNumber: {
      type: DataTypes.STRING(30),
      allowNull: false,
      field: 'phone_number'
    },
    country: {
      type: DataTypes.STRING(3),
      allowNull: false
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    providerPaymentId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'provider_payment_id'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PaymentStatus)),
      allowNull: false,
      defaultValue: PaymentStatus.PENDING
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'failure_reason'
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    originalPaymentId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'original_payment_id',
      references: {
        model: 'payments',
        key: 'id'
      }
    },
    customerMessage: {
      type: DataTypes.STRING(22),
      allowNull: true,
      field: 'customer_message'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at'
    },
    failedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'failed_at'
    }
  },
  {
    sequelize,
    tableName: 'payments',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['application_id', 'reference']
      },
      {
        fields: ['type']
      },
      {
        fields: ['original_payment_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['provider_payment_id']
      },
      {
        fields: ['created_at']
      }
    ]
  }
);

export default Payment;
