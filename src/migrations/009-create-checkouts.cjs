'use strict';

const SCHEMA = 'reignova_pay';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'checkouts', schema: SCHEMA }, {
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
      provider_checkout_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      redirect_url: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      checkout_code: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      return_url: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      return_method: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM(
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
        type: Sequelize.STRING(10),
        allowNull: true
      },
      countries: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      amounts: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      payer: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      reason: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      expires_after: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      deposit_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      deposit_status: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      deposits_history: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      failure_reason: {
        type: Sequelize.TEXT,
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
      expired_at: {
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

    await queryInterface.addIndex({ tableName: 'checkouts', schema: SCHEMA }, ['application_id', 'reference'], {
      unique: true,
      name: 'checkouts_application_id_reference_unique'
    });
    await queryInterface.addIndex({ tableName: 'checkouts', schema: SCHEMA }, ['provider_checkout_id'], {
      name: 'checkouts_provider_checkout_id_index'
    });
    await queryInterface.addIndex({ tableName: 'checkouts', schema: SCHEMA }, ['checkout_code'], {
      name: 'checkouts_checkout_code_index'
    });
    await queryInterface.addIndex({ tableName: 'checkouts', schema: SCHEMA }, ['status'], {
      name: 'checkouts_status_index'
    });
    await queryInterface.addIndex({ tableName: 'checkouts', schema: SCHEMA }, ['created_at'], {
      name: 'checkouts_created_at_index'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'checkouts', schema: SCHEMA });
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "reignova_pay"."enum_checkouts_status";');
    } catch {
      // Ignore if not supported
    }
  }
};
