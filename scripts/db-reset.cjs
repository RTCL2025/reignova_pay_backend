'use strict';

const { spawnSync } = require('child_process');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run db:reset with NODE_ENV=production.');
  console.error('This command drops every table and re-seeds the database.');
  process.exit(1);
}

// The seeder undo goes FIRST, while the tables still exist.
//
// db:migrate:undo:all drops the tables the migrations created, but
// sequelize-cli's seeder bookkeeping table SequelizeData is created by the
// CLI itself, not by a migration, so it survives. Without this first step
// the closing db:seed:all sees the seeder already recorded, reports "No
// seeders found", and leaves the table empty — so db:reset would restore
// the schema but not the seed data on every run after the first.
//
// This is safe on a database that has never been seeded: sequelize-cli
// creates SequelizeData if it is missing and finds nothing to undo.
const steps = [
  ['db:seed:undo:all', 'Reverting seeders'],
  ['db:migrate:undo:all', 'Reverting all migrations'],
  ['db:migrate', 'Applying migrations'],
  ['db:seed:all', 'Seeding'],
];

for (const [command, label] of steps) {
  console.log(`\n=> ${label} (sequelize-cli ${command})`);

  const result = spawnSync('sequelize-cli', [command], {
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\ndb:reset failed during "${command}".`);
    process.exit(result.status === null ? 1 : result.status);
  }
}

console.log('\nDatabase reset complete.');
