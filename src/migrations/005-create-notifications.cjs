'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
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
      application_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'applications',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      event_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      callback_url: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'DELIVERED', 'FAILED'),
        allowNull: false,
        defaultValue: 'PENDING'
      },
      attempt_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      last_attempt_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      next_attempt_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      response_status: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      response_body: {
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notifications_status";');
  }
};
