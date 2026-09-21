'use strict';

const SCHEMA = 'reignova_pay';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'payments', schema: SCHEMA }, {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      application_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: { tableName: 'applications', schema: SCHEMA },
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      reference: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false
      },
      phone_number: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      country: {
        type: Sequelize.STRING(3),
        allowNull: false
      },
      provider: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      provider_payment_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'),
        allowNull: false,
        defaultValue: 'PENDING'
      },
      failure_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      failed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex({ tableName: 'payments', schema: SCHEMA }, ['application_id', 'reference'], {
      unique: true,
      name: 'payments_application_id_reference_unique'
    });
    await queryInterface.addIndex({ tableName: 'payments', schema: SCHEMA }, ['status'], {
      name: 'payments_status_index'
    });
    await queryInterface.addIndex({ tableName: 'payments', schema: SCHEMA }, ['provider_payment_id'], {
      name: 'payments_provider_payment_id_index'
    });
    await queryInterface.addIndex({ tableName: 'payments', schema: SCHEMA }, ['created_at'], {
      name: 'payments_created_at_index'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'payments', schema: SCHEMA });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "reignova_pay"."enum_payments_status";');
  }
};
