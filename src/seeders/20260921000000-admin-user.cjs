'use strict';

const { randomUUID } = require('crypto');

const ADMIN_EMAIL = 'sntandu@reignovatechnologies.com';

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM reignova_pay.admin_users WHERE email = :email LIMIT 1;',
      { replacements: { email: ADMIN_EMAIL } }
    );

    if (existing.length > 0) {
      return;
    }

    const now = new Date();

    await queryInterface.bulkInsert({ tableName: 'admin_users', schema: 'reignova_pay' }, [
      {
        id: randomUUID(),
        email: ADMIN_EMAIL,
        name: 'Shedrack Ntandu',
        password_hash: null,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        last_active: now,
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface) {
    // db:reset runs db:seed:undo:all before db:migrate:undo:all, but a
    // database that already had its migrations undone manually (tables
    // gone, SequelizeData row still present) reaches this seeder with
    // admin_users missing. That is the one condition tolerated here: any
    // other failure from bulkDelete should still surface.
    //
    // queryInterface.showAllTables() only lists tables in the default
    // (search_path) schema, so it would never see reignova_pay.admin_users
    // and would silently no-op forever. to_regclass is schema-explicit and
    // unambiguous instead.
    const [[{ table_exists: tableExists }]] = await queryInterface.sequelize.query(
      "SELECT to_regclass('reignova_pay.admin_users') IS NOT NULL AS table_exists;"
    );

    if (!tableExists) {
      return;
    }

    await queryInterface.bulkDelete(
      { tableName: 'admin_users', schema: 'reignova_pay' },
      { email: ADMIN_EMAIL }
    );
  }
};
