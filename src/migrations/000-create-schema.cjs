'use strict';

const SCHEMA = 'reignova_pay';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}";`);
  },

  /**
   * Deliberately does not drop the schema.
   *
   * sequelize-cli's own bookkeeping tables (`SequelizeMeta`, `SequelizeData`) live
   * inside this schema, because `migrationStorageTableSchema` points them here. A
   * `DROP SCHEMA ... CASCADE` would therefore destroy the very table the CLI is about
   * to write to in order to record this revert, and `db:migrate:undo:all` would exit
   * non-zero with `schema "reignova_pay" does not exist` even though every table had
   * already come down cleanly.
   *
   * Leaving an empty schema behind costs nothing and keeps `undo:all` honest about
   * whether it succeeded. `up` is idempotent, so a later re-migrate is unaffected.
   */
  async down() {
    // Intentionally empty — see the comment above.
  }
};
