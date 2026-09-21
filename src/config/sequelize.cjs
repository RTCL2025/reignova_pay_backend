'use strict';

require('dotenv').config();

/**
 * Supabase terminates TLS with its own CA, which Node does not trust by
 * default, so certificate verification is disabled while TLS itself stays on.
 */
const supabaseSsl = {
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
};

const storage = {
  migrationStorageTableName: 'SequelizeMeta',
  seederStorage: 'sequelize',
  seederStorageTableName: 'SequelizeData',
};

module.exports = {
  // development's DATABASE_URL can point at Supabase or at a plain local
  // Postgres, so it honours DB_SSL the same way src/config/database.ts does:
  // no dialectOptions at all unless DB_SSL=true. Without this a developer
  // pointed at local Postgres with DB_SSL=false would get
  // "The server does not support SSL connections" from db:migrate, even
  // though the app itself connects fine.
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: process.env.DB_SSL === 'true' ? supabaseSsl : {},
    ...storage,
  },

  // Local Docker PostgreSQL from docker-compose.yml. No TLS: the container
  // serves plaintext only.
  //
  // These values are deliberately hardcoded rather than read from DB_* env
  // vars. The DB_* vars describe the developer's Supabase or local dev
  // database, and dotenv loads them here too — so reading them would make
  // NODE_ENV=test silently target the dev database. This block is the target
  // of destructive commands (db:migrate:undo:all, db:reset), so it must name
  // exactly one thing: the docker-compose postgres service. Keep these in
  // sync with docker-compose.yml.
  test: {
    username: 'postgres',
    password: 'postgres',
    database: 'payment_service_test',
    host: 'localhost',
    port: 5435,
    dialect: 'postgres',
    logging: false,
    ...storage,
  },

  // Unlike development, SSL is forced unconditionally here and does not read
  // DB_SSL: production always targets Supabase, and must never silently
  // downgrade to a plaintext connection because DB_SSL was left unset.
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: supabaseSsl,
    logging: false,
    ...storage,
  },
};
