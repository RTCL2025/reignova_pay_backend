import { DataTypes, QueryInterface } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('notifications', {
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
    event_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    callback_url: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'DELIVERED', 'FAILED'),
      allowNull: false,
      defaultValue: 'PENDING'
    },
    attempt_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    last_attempt_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    next_attempt_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    response_status: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    response_body: {
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

  await queryInterface.addIndex('notifications', ['status'], {
    name: 'notifications_status_index'
  });
  await queryInterface.addIndex('notifications', ['next_attempt_at'], {
    name: 'notifications_next_attempt_at_index'
  });
  await queryInterface.addIndex('notifications', ['application_id'], {
    name: 'notifications_application_id_index'
  });
  await queryInterface.addIndex('notifications', ['payment_id'], {
    name: 'notifications_payment_id_index'
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('notifications');
}
