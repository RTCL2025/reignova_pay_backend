'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      role: {
        type: Sequelize.ENUM('SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'AUDITOR', 'SUPPORT_AGENT'),
        allowNull: false,
        defaultValue: 'SUPER_ADMIN'
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'SUSPENDED'),
        allowNull: false,
        defaultValue: 'ACTIVE'
      },
      last_active: {
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

    await queryInterface.addIndex('admin_users', ['email'], {
      unique: true,
      name: 'admin_users_email_unique'
    });
    await queryInterface.addIndex('admin_users', ['role'], {
      name: 'admin_users_role_index'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_users');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_admin_users_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_admin_users_status";');
  }
};
