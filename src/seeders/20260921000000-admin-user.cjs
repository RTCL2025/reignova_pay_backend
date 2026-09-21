'use strict';

const { randomUUID } = require('crypto');

const ADMIN_EMAIL = 'sntandu@reignovatechnologies.com';

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM admin_users WHERE email = :email LIMIT 1;',
      { replacements: { email: ADMIN_EMAIL } }
    );

    if (existing.length > 0) {
      return;
    }

    const now = new Date();

    await queryInterface.bulkInsert('admin_users', [
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
    const tables = await queryInterface.showAllTables();

    if (!tables.includes('admin_users')) {
      return;
    }

    await queryInterface.bulkDelete('admin_users', { email: ADMIN_EMAIL });
  }
};
