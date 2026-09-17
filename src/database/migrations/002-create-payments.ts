import { DataTypes, QueryInterface } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('payments', {
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
    reference: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false
    },
    phone_number: {
      type: DataTypes.STRING(30),
      allowNull: false
    },
    country: {
      type: DataTypes.STRING(3),
      allowNull: false
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    provider_payment_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'),
      allowNull: false,
      defaultValue: 'PENDING'
    },
    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    failed_at: {
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

  await queryInterface.addIndex('payments', ['application_id', 'reference'], {
    unique: true,
    name: 'payments_application_id_reference_unique'
  });
  await queryInterface.addIndex('payments', ['status'], {
    name: 'payments_status_index'
  });
  await queryInterface.addIndex('payments', ['provider_payment_id'], {
    name: 'payments_provider_payment_id_index'
  });
  await queryInterface.addIndex('payments', ['created_at'], {
    name: 'payments_created_at_index'
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('payments');
}
