import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export interface AuditLogAttributes {
  id: string;
  actor: string;
  applicationId?: string | null;
  resourceType: string;
  resourceId: string;
  action: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AuditLogCreationAttributes = Optional<
  AuditLogAttributes,
  'id' | 'applicationId' | 'metadata' | 'ipAddress' | 'createdAt' | 'updatedAt'
>;

export class AuditLog
  extends Model<AuditLogAttributes, AuditLogCreationAttributes>
  implements AuditLogAttributes
{
  declare public id: string;
  declare public actor: string;
  declare public applicationId: string | null;
  declare public resourceType: string;
  declare public resourceId: string;
  declare public action: string;
  declare public metadata: Record<string, unknown> | null;
  declare public ipAddress: string | null;
  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;
}

AuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    actor: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    applicationId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'application_id',
      references: {
        model: 'applications',
        key: 'id'
      }
    },
    resourceType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'resource_type'
    },
    resourceId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'resource_id'
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address'
    }
  },
  {
    sequelize,
    tableName: 'audit_logs',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['application_id']
      },
      {
        fields: ['resource_type', 'resource_id']
      },
      {
        fields: ['created_at']
      }
    ]
  }
);

export default AuditLog;
