import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export enum AdminUserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OPERATIONS_ADMIN = 'OPERATIONS_ADMIN',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  AUDITOR = 'AUDITOR',
  SUPPORT_AGENT = 'SUPPORT_AGENT'
}

export enum AdminUserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED'
}

export interface AdminUserAttributes {
  id: string;
  email: string;
  name: string;
  passwordHash?: string | null;
  role: AdminUserRole;
  status: AdminUserStatus;
  lastActive?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AdminUserCreationAttributes = Optional<
  AdminUserAttributes,
  'id' | 'passwordHash' | 'role' | 'status' | 'lastActive' | 'createdAt' | 'updatedAt'
>;

export class AdminUser
  extends Model<AdminUserAttributes, AdminUserCreationAttributes>
  implements AdminUserAttributes
{
  declare public id: string;
  declare public email: string;
  declare public name: string;
  declare public passwordHash: string | null;
  declare public role: AdminUserRole;
  declare public status: AdminUserStatus;
  declare public lastActive: Date | null;
  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;
}

AdminUser.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'password_hash'
    },
    role: {
      type: DataTypes.ENUM(...Object.values(AdminUserRole)),
      allowNull: false,
      defaultValue: AdminUserRole.SUPER_ADMIN
    },
    status: {
      type: DataTypes.ENUM(...Object.values(AdminUserStatus)),
      allowNull: false,
      defaultValue: AdminUserStatus.ACTIVE
    },
    lastActive: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_active'
    }
  },
  {
    sequelize,
    tableName: 'admin_users',
    timestamps: true,
    underscored: true
  }
);

export default AdminUser;
