import { DataTypes, QueryInterface } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('applications', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
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
    api_key_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true
    },
    api_key_prefix: {
      type: DataTypes.STRING(16),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'SUSPENDED', 'REVOKED'),
      allowNull: false,
      defaultValue: 'ACTIVE'
    },
    webhook_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    webhook_secret: {
      type: DataTypes.STRING(100),
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

  await queryInterface.addIndex('applications', ['slug'], { unique: true });
  await queryInterface.addIndex('applications', ['api_key_hash'], { unique: true });
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('applications');
}
