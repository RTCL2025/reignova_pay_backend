'use strict';

require('dotenv').config();

const env = process.env;

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
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: supabaseSsl,
    ...storage,
  },

  // Local Docker PostgreSQL. No TLS: the container serves plaintext only.
  test: {
    username: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || 'postgres',
    database: env.DB_NAME || 'payment_service_test',
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT || '5435', 10),
    dialect: 'postgres',
    logging: false,
    ...storage,
  },

  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: supabaseSsl,
    logging: false,
    ...storage,
  },
};
