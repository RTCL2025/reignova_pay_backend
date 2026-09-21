'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_attempts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      payment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'payments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      attempt_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      provider: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      provider_request_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      request_payload: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      response_payload: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      error_code: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      error_message: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex('payment_attempts', ['payment_id'], {
      name: 'payment_attempts_payment_id_index'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payment_attempts');
  }
};
