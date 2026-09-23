'use strict';

const SCHEMA = 'reignova_pay';

/**
 * Actually makes `notifications.payment_id` nullable.
 *
 * Migration 012 asked for this with `queryInterface.changeColumn(..., {
 * allowNull: true, references: {...} })`. It reported success and did nothing:
 * with a `references` option Sequelize's Postgres dialect emits the foreign key
 * change and never emits `ALTER COLUMN ... DROP NOT NULL`. The column stayed
 * NOT NULL while the CHECK constraint from 012 demanded that checkout-scoped
 * rows have a NULL payment_id, so every checkout notification insert failed
 * with "null value in column payment_id violates not-null constraint".
 *
 * In Postgres that error aborts the whole surrounding transaction, so the
 * pawaPay deposit callback rolled back and returned 500 — the payment and the
 * checkout never settled.
 *
 * Raw SQL here rather than changeColumn, for the reason above. Both statements
 * are idempotent so this is safe on a database where 012 happened to work.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "${SCHEMA}"."notifications"
      ALTER COLUMN "payment_id" DROP NOT NULL;
    `);
  },

  async down(queryInterface) {
    // Checkout-scoped rows cannot satisfy a NOT NULL payment_id.
    await queryInterface.sequelize.query(`
      DELETE FROM "${SCHEMA}"."notifications" WHERE payment_id IS NULL;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "${SCHEMA}"."notifications"
      ALTER COLUMN "payment_id" SET NOT NULL;
    `);
  }
};
