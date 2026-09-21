'use strict';

const SCHEMA = 'reignova_pay';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn({ tableName: 'payments', schema: SCHEMA }, 'type', {
      type: Sequelize.ENUM('DEPOSIT', 'PAYOUT', 'REFUND'),
      allowNull: false,
      defaultValue: 'DEPOSIT'
    });

    await queryInterface.addColumn({ tableName: 'payments', schema: SCHEMA }, 'original_payment_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: { tableName: 'payments', schema: SCHEMA },
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn({ tableName: 'payments', schema: SCHEMA }, 'customer_message', {
      type: Sequelize.STRING(22),
      allowNull: true
    });

    await queryInterface.addIndex({ tableName: 'payments', schema: SCHEMA }, ['type'], {
      name: 'payments_type_index'
    });

    await queryInterface.addIndex({ tableName: 'payments', schema: SCHEMA }, ['original_payment_id'], {
      name: 'payments_original_payment_id_index'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex({ tableName: 'payments', schema: SCHEMA }, 'payments_original_payment_id_index');
    await queryInterface.removeIndex({ tableName: 'payments', schema: SCHEMA }, 'payments_type_index');
    await queryInterface.removeColumn({ tableName: 'payments', schema: SCHEMA }, 'customer_message');
    await queryInterface.removeColumn({ tableName: 'payments', schema: SCHEMA }, 'original_payment_id');
    await queryInterface.removeColumn({ tableName: 'payments', schema: SCHEMA }, 'type');
    // Drop enum type in PostgreSQL if needed
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "reignova_pay"."enum_payments_type";');
    } catch {
      // Ignore if not supported or not exists
    }
  }
};
