import { Sequelize } from 'sequelize';
import { env } from './env.js';
import { logger } from './logger.js';

const isTest = env.NODE_ENV === 'test';

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
