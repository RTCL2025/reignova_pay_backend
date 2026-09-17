import { DataTypes, QueryInterface } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('webhook_events', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    event_key: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    event_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    payment_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'payments',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    provider_payment_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    signature: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('RECEIVED', 'PROCESSED', 'FAILED'),
      allowNull: false,
      defaultValue: 'RECEIVED'
    },
    processed_at: {
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

  await queryInterface.addIndex('webhook_events', ['provider', 'event_key'], {
    unique: true,
    name: 'webhook_events_provider_event_key_unique'
  });
  await queryInterface.addIndex('webhook_events', ['payment_id'], {
    name: 'webhook_events_payment_id_index'
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('webhook_events');
}
