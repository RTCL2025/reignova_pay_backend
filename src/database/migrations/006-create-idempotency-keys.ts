import { DataTypes, QueryInterface } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('idempotency_keys', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    application_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'applications',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    key: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    request_hash: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    response_status: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    response_body: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    resource_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
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

  await queryInterface.addIndex('idempotency_keys', ['application_id', 'key'], {
    unique: true,
    name: 'idempotency_keys_application_id_key_unique'
  });
  await queryInterface.addIndex('idempotency_keys', ['expires_at'], {
    name: 'idempotency_keys_expires_at_index'
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('idempotency_keys');
}
