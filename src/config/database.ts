import { Sequelize } from 'sequelize';
import { env } from './env.js';
import { logger } from './logger.js';

const isTest = env.NODE_ENV === 'test';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export interface ConnectionTarget {
  databaseUrl?: string;
  host: string;
  dbSsl: boolean;
}

/**
 * Refuse to start when a remote database would be reached without TLS.
 *
 * Supabase's pooler accepts plaintext connections — it does not enforce TLS.
 * Since SSL here is opt-in via DB_SSL, an unset or mistyped DB_SSL in a
 * deployment would silently send this service's credentials and payment data
 * across the public internet in the clear, with nothing failing or warning.
 * Failing closed at startup is the only way that misconfiguration gets noticed.
 *
 * A host that cannot be parsed is treated as remote: an unknown target has not
 * been shown to be local, and guessing in the permissive direction is the whole
 * failure mode this guard exists to prevent.
 */
export function assertTlsForRemoteHost(target: ConnectionTarget): void {
  if (target.dbSsl) {
    return;
  }

  let host = target.host;
  if (target.databaseUrl) {
    try {
      host = new URL(target.databaseUrl).hostname;
    } catch {
      host = '';
    }
  }

  if (LOCAL_HOSTS.has(host)) {
    return;
  }

  throw new Error(
    `Refusing to connect to ${host ? `"${host}"` : 'an unparseable database host'} without TLS. ` +
      'DB_SSL is not "true", so credentials and payment data would cross the network in cleartext. ' +
      'Set DB_SSL=true for any non-local database.'
  );
}

assertTlsForRemoteHost({
  databaseUrl: env.DATABASE_URL,
  host: env.DB_HOST,
  dbSsl: env.DB_SSL
});

export const sequelize = env.DATABASE_URL
  ? new Sequelize(env.DATABASE_URL, {
      dialect: 'postgres',
      logging: isTest ? false : (msg) => logger.debug({ msg }, 'Sequelize SQL'),
      pool: {
        min: env.DB_POOL_MIN,
        max: env.DB_POOL_MAX,
        acquire: 30000,
        idle: 10000
      },
      dialectOptions: env.DB_SSL
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false
            }
          }
        : {}
    })
  : new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
      host: env.DB_HOST,
      port: env.DB_PORT,
      dialect: 'postgres',
      logging: isTest ? false : (msg) => logger.debug({ msg }, 'Sequelize SQL'),
      pool: {
        min: env.DB_POOL_MIN,
        max: env.DB_POOL_MAX,
        acquire: 30000,
        idle: 10000
      },
      dialectOptions: env.DB_SSL
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false
            }
          }
        : {}
    });

export async function testDatabaseConnection(): Promise<void> {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error({ err: error }, 'Unable to connect to the database');
    throw error;
  }
}

export default sequelize;
