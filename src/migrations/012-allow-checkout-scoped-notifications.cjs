'use strict';

const SCHEMA = 'reignova_pay';
const TABLE = { tableName: 'notifications', schema: SCHEMA };

/**
 * Lets a merchant notification belong to a checkout rather than a payment.
 *
 * Hosted checkouts never create a local `payments` row — pawaPay creates the
 * deposit on its own side — so every checkout lifecycle event was unnotifiable:
 * `payment_id` was NOT NULL with a foreign key into `payments`, and there was no
 * payment to point at. Merchants consequently heard nothing at all about a
 * hosted checkout completing or failing.
 *
 * After this migration exactly one of `payment_id` / `checkout_id` is set, which
 * the CHECK constraint enforces.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn(TABLE, 'payment_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: { tableName: 'payments', schema: SCHEMA },
        key: 'id'
      }
    });

    await queryInterface.addColumn(TABLE, 'checkout_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: { tableName: 'checkouts', schema: SCHEMA },
        key: 'id'
      }
    });

    await queryInterface.addIndex(TABLE, ['checkout_id'], {
      name: 'notifications_checkout_id_index'
    });

    // A notification with neither subject is undeliverable and a notification
    // with both is ambiguous, so reject both at the database.
    await queryInterface.sequelize.query(`
      ALTER TABLE "${SCHEMA}"."notifications"
      ADD CONSTRAINT notifications_subject_check
      CHECK (
        (payment_id IS NOT NULL AND checkout_id IS NULL)
        OR (payment_id IS NULL AND checkout_id IS NOT NULL)
      );
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "${SCHEMA}"."notifications"
      DROP CONSTRAINT IF EXISTS notifications_subject_check;
    `);

    // Checkout-scoped rows cannot be represented once the column is gone, and
    // they would block restoring the NOT NULL, so drop them on the way down.
    await queryInterface.sequelize.query(`
      DELETE FROM "${SCHEMA}"."notifications" WHERE checkout_id IS NOT NULL;
    `);

    await queryInterface.removeIndex(TABLE, 'notifications_checkout_id_index');
    await queryInterface.removeColumn(TABLE, 'checkout_id');

    await queryInterface.changeColumn(TABLE, 'payment_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: { tableName: 'payments', schema: SCHEMA },
        key: 'id'
      }
    });
  }
};
