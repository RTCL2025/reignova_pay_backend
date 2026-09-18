import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export enum CheckoutStatus {
  PENDING = 'PENDING',
  WAITING_PAYMENT = 'WAITING_PAYMENT',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}

export interface CheckoutAttributes {
  id: string;
  applicationId: string;
  reference: string;
  publicToken?: string | null;
  providerCheckoutId?: string | null;
  redirectUrl?: string | null;
  checkoutCode?: string | null;
  returnUrl: string;
  cancelUrl?: string | null;
  returnMethod?: string | null;
  status: CheckoutStatus;
  defaultLanguage?: string | null;
  countries?: string[] | null;
  amounts?: Array<{ country: string; currency: string; amount: string | number }> | null;
  payer?: Record<string, unknown> | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  reason?: Record<string, unknown> | null;
  expiresAfter?: number | null;
  expiresAt?: Date | null;
  depositId?: string | null;
  depositStatus?: string | null;
  depositsHistory?: Array<Record<string, unknown>> | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown> | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  expiredAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CheckoutCreationAttributes = Optional<
  CheckoutAttributes,
  | 'id'
  | 'publicToken'
  | 'providerCheckoutId'
  | 'redirectUrl'
  | 'checkoutCode'
  | 'cancelUrl'
  | 'returnMethod'
  | 'status'
  | 'defaultLanguage'
  | 'countries'
  | 'amounts'
  | 'payer'
  | 'customerName'
  | 'customerEmail'
  | 'customerPhone'
  | 'reason'
  | 'expiresAfter'
  | 'expiresAt'
  | 'depositId'
  | 'depositStatus'
  | 'depositsHistory'
  | 'failureReason'
  | 'metadata'
  | 'completedAt'
  | 'failedAt'
  | 'expiredAt'
  | 'createdAt'
  | 'updatedAt'
>;

export class Checkout
  extends Model<CheckoutAttributes, CheckoutCreationAttributes>
  implements CheckoutAttributes
{
  declare public id: string;
  declare public applicationId: string;
  declare public reference: string;
  declare public publicToken: string | null;
  declare public providerCheckoutId: string | null;
  declare public redirectUrl: string | null;
  declare public checkoutCode: string | null;
  declare public returnUrl: string;
  declare public cancelUrl: string | null;
  declare public returnMethod: string | null;
  declare public status: CheckoutStatus;
  declare public defaultLanguage: string | null;
  declare public countries: string[] | null;
  declare public amounts: Array<{ country: string; currency: string; amount: string | number }> | null;
  declare public payer: Record<string, unknown> | null;
  declare public customerName: string | null;
  declare public customerEmail: string | null;
  declare public customerPhone: string | null;
  declare public reason: Record<string, unknown> | null;
  declare public expiresAfter: number | null;
  declare public expiresAt: Date | null;
  declare public depositId: string | null;
  declare public depositStatus: string | null;
  declare public depositsHistory: Array<Record<string, unknown>> | null;
  declare public failureReason: string | null;
  declare public metadata: Record<string, unknown> | null;
  declare public completedAt: Date | null;
  declare public failedAt: Date | null;
  declare public expiredAt: Date | null;
  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;
}

Checkout.init(
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
    publicToken: {
      type: DataTypes.STRING(80),
      allowNull: true,
      unique: true,
      field: 'public_token'
    },
    providerCheckoutId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'provider_checkout_id'
    },
    redirectUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'redirect_url'
    },
    checkoutCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'checkout_code'
    },
    returnUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'return_url'
    },
    cancelUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'cancel_url'
    },
    customerName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'customer_name'
    },
    customerEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'customer_email'
    },
    customerPhone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'customer_phone'
    },
    returnMethod: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'return_method'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(CheckoutStatus)),
      allowNull: false,
      defaultValue: CheckoutStatus.PENDING
    },
    defaultLanguage: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'default_language'
    },
    countries: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    amounts: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    payer: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    reason: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    expiresAfter: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'expires_after'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    depositId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'deposit_id'
    },
    depositStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'deposit_status'
    },
    depositsHistory: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'deposits_history'
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'failure_reason'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
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
    },
    expiredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expired_at'
    }
  },
  {
    sequelize,
    tableName: 'checkouts',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['application_id', 'reference']
      },
      {
        fields: ['provider_checkout_id']
      },
      {
        fields: ['checkout_code']
      },
      {
        unique: true,
        fields: ['public_token']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      }
    ]
  }
);

export default Checkout;
