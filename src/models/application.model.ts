import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export enum ApplicationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED'
}

export interface ApplicationAttributes {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  apiKeyHash: string;
  apiKeyPrefix: string;
  status: ApplicationStatus;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ApplicationCreationAttributes = Optional<
  ApplicationAttributes,
  'id' | 'status' | 'description' | 'webhookUrl' | 'webhookSecret' | 'createdAt' | 'updatedAt'
>;

export class Application
  extends Model<ApplicationAttributes, ApplicationCreationAttributes>
  implements ApplicationAttributes
{
  declare public id: string;
  declare public name: string;
  declare public slug: string;
  declare public description: string | null;
  declare public apiKeyHash: string;
  declare public apiKeyPrefix: string;
  declare public status: ApplicationStatus;
  declare public webhookUrl: string | null;
  declare public webhookSecret: string | null;
  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;
}

Application.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    apiKeyHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'api_key_hash'
    },
    apiKeyPrefix: {
      type: DataTypes.STRING(16),
      allowNull: false,
      field: 'api_key_prefix'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ApplicationStatus)),
      allowNull: false,
      defaultValue: ApplicationStatus.ACTIVE
    },
    webhookUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'webhook_url'
    },
    webhookSecret: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'webhook_secret'
    }
  },
  {
    sequelize,
    tableName: 'applications',
    timestamps: true,
    underscored: true
  }
);

export default Application;
