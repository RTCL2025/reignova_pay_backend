import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export interface IdempotencyKeyAttributes {
  id: string;
  applicationId: string;
  key: string;
  requestHash: string;
  responseStatus?: number | null;
  responseBody?: Record<string, unknown> | null;
  resourceId?: string | null;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IdempotencyKeyCreationAttributes = Optional<
  IdempotencyKeyAttributes,
  'id' | 'responseStatus' | 'responseBody' | 'resourceId' | 'createdAt' | 'updatedAt'
>;

export class IdempotencyKey
  extends Model<IdempotencyKeyAttributes, IdempotencyKeyCreationAttributes>
  implements IdempotencyKeyAttributes
{
  declare public id: string;
  declare public applicationId: string;
  declare public key: string;
  declare public requestHash: string;
  declare public responseStatus: number | null;
  declare public responseBody: Record<string, unknown> | null;
  declare public resourceId: string | null;
  declare public expiresAt: Date;
  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;
}

IdempotencyKey.init(
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
    key: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    requestHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'request_hash'
    },
    responseStatus: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'response_status'
    },
    responseBody: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'response_body'
    },
    resourceId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'resource_id'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at'
    }
  },
  {
    sequelize,
    tableName: 'idempotency_keys',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['application_id', 'key']
      },
      {
        fields: ['expires_at']
      }
    ]
  }
);

export default IdempotencyKey;
