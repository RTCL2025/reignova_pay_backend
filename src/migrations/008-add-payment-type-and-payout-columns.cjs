'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payments', 'type', {
      type: Sequelize.ENUM('DEPOSIT', 'PAYOUT', 'REFUND'),
      allowNull: false,
      defaultValue: 'DEPOSIT'
    });

    await queryInterface.addColumn('payments', 'original_payment_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'payments',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('payments', 'customer_message', {
      type: Sequelize.STRING(22),
      allowNull: true
    });

    await queryInterface.addIndex('payments', ['type'], {
      name: 'payments_type_index'
    });

    await queryInterface.addIndex('payments', ['original_payment_id'], {
      name: 'payments_original_payment_id_index'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('payments', 'payments_original_payment_id_index');
    await queryInterface.removeIndex('payments', 'payments_type_index');
    await queryInterface.removeColumn('payments', 'customer_message');
    await queryInterface.removeColumn('payments', 'original_payment_id');
    await queryInterface.removeColumn('payments', 'type');
    // Drop enum type in PostgreSQL if needed
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_type";');
    } catch {
      // Ignore if not supported or not exists
    }
  }
};
