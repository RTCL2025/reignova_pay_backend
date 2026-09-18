import { DataTypes, QueryInterface } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('checkouts', {
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
    provider_checkout_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    redirect_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    checkout_code: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    return_url: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    return_method: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM(
        'PENDING',
        'WAITING_PAYMENT',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
        'EXPIRED',
        'CANCELLED'
      ),
      allowNull: false,
      defaultValue: 'PENDING'
    },
    default_language: {
      type: DataTypes.STRING(10),
      allowNull: true
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
    expires_after: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deposit_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    deposit_status: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    deposits_history: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    failure_reason: {
      type: DataTypes.TEXT,
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
    expired_at: {
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

  await queryInterface.addIndex('checkouts', ['application_id', 'reference'], {
    unique: true,
    name: 'checkouts_application_id_reference_unique'
  });
  await queryInterface.addIndex('checkouts', ['provider_checkout_id'], {
    name: 'checkouts_provider_checkout_id_index'
  });
  await queryInterface.addIndex('checkouts', ['checkout_code'], {
    name: 'checkouts_checkout_code_index'
  });
  await queryInterface.addIndex('checkouts', ['status'], {
    name: 'checkouts_status_index'
  });
  await queryInterface.addIndex('checkouts', ['created_at'], {
    name: 'checkouts_created_at_index'
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('checkouts');
  try {
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_checkouts_status";');
  } catch {
    // Ignore if not supported
  }
}
