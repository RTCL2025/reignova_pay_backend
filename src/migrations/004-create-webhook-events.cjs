'use strict';

const SCHEMA = 'reignova_pay';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'webhook_events', schema: SCHEMA }, {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      provider: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      event_key: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      event_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      payment_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: { tableName: 'payments', schema: SCHEMA },
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      provider_payment_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      signature: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('RECEIVED', 'PROCESSED', 'FAILED'),
        allowNull: false,
        defaultValue: 'RECEIVED'
      },
      processed_at: {
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

    await queryInterface.addIndex({ tableName: 'webhook_events', schema: SCHEMA }, ['provider', 'event_key'], {
      unique: true,
      name: 'webhook_events_provider_event_key_unique'
    });
    await queryInterface.addIndex({ tableName: 'webhook_events', schema: SCHEMA }, ['payment_id'], {
      name: 'webhook_events_payment_id_index'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'webhook_events', schema: SCHEMA });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "reignova_pay"."enum_webhook_events_status";');
  }
};
