'use strict';

const SCHEMA = 'reignova_pay';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'applications', schema: SCHEMA }, {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      api_key_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true
      },
      api_key_prefix: {
        type: Sequelize.STRING(16),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'SUSPENDED', 'REVOKED'),
        allowNull: false,
        defaultValue: 'ACTIVE'
      },
      webhook_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      webhook_secret: {
        type: Sequelize.STRING(100),
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

    await queryInterface.addIndex({ tableName: 'applications', schema: SCHEMA }, ['slug'], { unique: true });
    await queryInterface.addIndex({ tableName: 'applications', schema: SCHEMA }, ['api_key_hash'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'applications', schema: SCHEMA });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "reignova_pay"."enum_applications_status";');
  }
};
