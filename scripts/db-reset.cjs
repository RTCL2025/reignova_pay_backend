'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

// Guard on the resolved target host, not on NODE_ENV. sequelize-cli resolves
// its env the same way: args.env || process.env.NODE_ENV || 'development'.
// development and production both read DATABASE_URL, so an env-name check
// alone would let a developer with a Supabase URL in .env and no NODE_ENV
// set (i.e. the default 'development') run this against the live database.
const resolvedEnv = process.env.NODE_ENV || 'development';

let sequelizeConfig;
try {
  // eslint-disable-next-line import/no-dynamic-require
  sequelizeConfig = require(path.resolve(__dirname, '..', 'src', 'config', 'sequelize.cjs'));
} catch (err) {
  console.error(`Refusing to run db:reset: could not load src/config/sequelize.cjs (${err.message}).`);
  process.exit(1);
}

const envBlock = sequelizeConfig[resolvedEnv];

function resolveTarget(block) {
  if (!block) {
    return null;
  }

  if (block.host) {
    return { host: block.host, database: block.database || '(unknown database)' };
  }

  if (block.use_env_variable) {
    const raw = process.env[block.use_env_variable];
    if (!raw) {
      return null;
    }

    try {
      const url = new URL(raw);
      return {
        host: url.hostname,
        database: url.pathname.replace(/^\//, '') || '(unknown database)',
      };
    } catch {
      return null;
    }
  }

  return null;
}

const target = resolveTarget(envBlock);

if (!target) {
  console.error(
    `Refusing to run db:reset: could not determine the target database host for NODE_ENV=${resolvedEnv}.`
  );
  console.error(
    'This usually means the config block is missing or its use_env_variable (e.g. DATABASE_URL) is unset. ' +
      'An unknown target is not a safe target.'
  );
  process.exit(1);
}

const isLocalHost = LOCAL_HOSTS.has(target.host);
const allowRemote = process.env.DB_RESET_ALLOW_REMOTE === '1';

if (!isLocalHost && !allowRemote) {
  console.error(
    `Refusing to run db:reset against host "${target.host}" (database "${target.database}", NODE_ENV=${resolvedEnv}).`
  );
  console.error('This command drops every table and re-seeds the database.');
  console.error(
    'Only localhost, 127.0.0.1 and ::1 are allowed automatically. Set DB_RESET_ALLOW_REMOTE=1 to override deliberately.'
  );
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

  // A single command string (rather than a program + args array) avoids
  // Node's DEP0190 warning, which fires whenever args are combined with
  // shell: true. shell: true itself is kept for Windows compatibility,
  // where sequelize-cli is a .cmd/.ps1 shim that spawnSync cannot exec
  // directly.
  const result = spawnSync(`sequelize-cli ${command}`, {
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\ndb:reset failed during "${command}".`);
    process.exit(result.status === null ? 1 : result.status);
  }
}

console.log('\nDatabase reset complete.');
