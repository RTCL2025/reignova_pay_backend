'use strict';

const SCHEMA = 'reignova_pay';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'idempotency_keys', schema: SCHEMA }, {
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
      key: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      request_hash: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      response_status: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      response_body: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      resource_id: {
        type: Sequelize.UUID,
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
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

    await queryInterface.addIndex({ tableName: 'idempotency_keys', schema: SCHEMA }, ['application_id', 'key'], {
      unique: true,
      name: 'idempotency_keys_application_id_key_unique'
    });
    await queryInterface.addIndex({ tableName: 'idempotency_keys', schema: SCHEMA }, ['expires_at'], {
      name: 'idempotency_keys_expires_at_index'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'idempotency_keys', schema: SCHEMA });
  }
};
