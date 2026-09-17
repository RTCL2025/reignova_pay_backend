import { DataTypes, QueryInterface } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('payment_attempts', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    payment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'payments',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    attempt_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    provider_request_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    request_payload: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    response_payload: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    error_code: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    error_message: {
      type: DataTypes.TEXT,
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

  await queryInterface.addIndex('payment_attempts', ['payment_id'], {
    name: 'payment_attempts_payment_id_index'
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('payment_attempts');
}
