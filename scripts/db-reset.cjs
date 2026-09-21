'use strict';

const { spawnSync } = require('child_process');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run db:reset with NODE_ENV=production.');
  console.error('This command drops every table and re-seeds the database.');
  process.exit(1);
}

const steps = [
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
