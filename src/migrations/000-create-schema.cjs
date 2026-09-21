'use strict';

const SCHEMA = 'reignova_pay';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}";`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE;`);
  }
};
