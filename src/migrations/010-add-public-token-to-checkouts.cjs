'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('checkouts', 'public_token', {
      type: Sequelize.STRING(80),
      allowNull: true
    });

    await queryInterface.addColumn('checkouts', 'cancel_url', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('checkouts', 'customer_name', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.addColumn('checkouts', 'customer_email', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('checkouts', 'customer_phone', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    await queryInterface.addIndex('checkouts', ['public_token'], {
      unique: true,
      name: 'checkouts_public_token_unique'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('checkouts', 'checkouts_public_token_unique');
    await queryInterface.removeColumn('checkouts', 'customer_phone');
    await queryInterface.removeColumn('checkouts', 'customer_email');
    await queryInterface.removeColumn('checkouts', 'customer_name');
    await queryInterface.removeColumn('checkouts', 'cancel_url');
    await queryInterface.removeColumn('checkouts', 'public_token');
  }
};
