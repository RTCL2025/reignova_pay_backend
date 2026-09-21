'use strict';

const SCHEMA = 'reignova_pay';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn({ tableName: 'checkouts', schema: SCHEMA }, 'public_token', {
      type: Sequelize.STRING(80),
      allowNull: true
    });

    await queryInterface.addColumn({ tableName: 'checkouts', schema: SCHEMA }, 'cancel_url', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn({ tableName: 'checkouts', schema: SCHEMA }, 'customer_name', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.addColumn({ tableName: 'checkouts', schema: SCHEMA }, 'customer_email', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn({ tableName: 'checkouts', schema: SCHEMA }, 'customer_phone', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    await queryInterface.addIndex({ tableName: 'checkouts', schema: SCHEMA }, ['public_token'], {
      unique: true,
      name: 'checkouts_public_token_unique'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex({ tableName: 'checkouts', schema: SCHEMA }, 'checkouts_public_token_unique');
    await queryInterface.removeColumn({ tableName: 'checkouts', schema: SCHEMA }, 'customer_phone');
    await queryInterface.removeColumn({ tableName: 'checkouts', schema: SCHEMA }, 'customer_email');
    await queryInterface.removeColumn({ tableName: 'checkouts', schema: SCHEMA }, 'customer_name');
    await queryInterface.removeColumn({ tableName: 'checkouts', schema: SCHEMA }, 'cancel_url');
    await queryInterface.removeColumn({ tableName: 'checkouts', schema: SCHEMA }, 'public_token');
  }
};
