import { DataTypes, QueryInterface } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('admin_users', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
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
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'AUDITOR', 'SUPPORT_AGENT'),
      allowNull: false,
      defaultValue: 'SUPER_ADMIN'
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'SUSPENDED'),
      allowNull: false,
      defaultValue: 'ACTIVE'
    },
    last_active: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  });

  await queryInterface.addIndex('admin_users', ['email'], {
    unique: true,
    name: 'admin_users_email_unique'
  });
  await queryInterface.addIndex('admin_users', ['role'], {
    name: 'admin_users_role_index'
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('admin_users');
}
