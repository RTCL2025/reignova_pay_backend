import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

interface AdminDbConfig {
  clientConfig: pg.ClientConfig;
  targetDb: string;
}

export function getAdminDbConfig(): AdminDbConfig {
  if (env.DATABASE_URL) {
    const parsedUrl = new URL(env.DATABASE_URL);
    const targetDb = parsedUrl.pathname.replace(/^\//, '') || env.DB_NAME || 'payment_service';
    parsedUrl.pathname = '/postgres';
    return {
      clientConfig: {
        connectionString: parsedUrl.toString(),
        ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined
      },
      targetDb
    };
  }

  return {
    clientConfig: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: 'postgres',
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined
    },
    targetDb: env.DB_NAME || 'payment_service'
  };
}

export async function createDatabase(): Promise<void> {
  const { clientConfig, targetDb } = getAdminDbConfig();
  const client = new pg.Client(clientConfig);

  try {
    await client.connect();
    const checkRes = await client.query('SELECT 1 FROM pg_database WHERE datname = $1;', [targetDb]);

    if (checkRes.rowCount && checkRes.rowCount > 0) {
      logger.info({ database: targetDb }, 'Database already exists');
      console.info(`ℹ️  Database '${targetDb}' already exists.`);
      return;
    }

    const sanitizedDb = targetDb.replace(/[^a-zA-Z0-9_]/g, '');
    await client.query(`CREATE DATABASE "${sanitizedDb}";`);
    logger.info({ database: sanitizedDb }, 'Database created successfully');
    console.info(`✅ Database '${sanitizedDb}' created successfully.`);
  } catch (err) {
    logger.error({ err, targetDb }, 'Failed to create database');
    throw err;
  } finally {
    await client.end();
  }
}

export async function dropDatabase(): Promise<void> {
  const { clientConfig, targetDb } = getAdminDbConfig();
  const client = new pg.Client(clientConfig);

  try {
    await client.connect();
    const sanitizedDb = targetDb.replace(/[^a-zA-Z0-9_]/g, '');

    // Terminate existing active client connections to allow DROP
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();`,
      [sanitizedDb]
    );

    await client.query(`DROP DATABASE IF EXISTS "${sanitizedDb}";`);
    logger.info({ database: sanitizedDb }, 'Database dropped successfully');
    console.info(`🗑️  Database '${sanitizedDb}' dropped successfully.`);
  } catch (err) {
    logger.error({ err, targetDb }, 'Failed to drop database');
    throw err;
  } finally {
    await client.end();
  }
}

async function runCli(): Promise<void> {
  const command = process.argv[2]?.toLowerCase();

  switch (command) {
    case 'create':
      await createDatabase();
      break;

    case 'drop':
      await dropDatabase();
      break;

    case 'reset': {
      console.info('🔄 Resetting database...');
      await dropDatabase();
      await createDatabase();

      // Lazy import migrate and seed to ensure connection connects to newly created DB
      const { migrator } = await import('./migrate.js');
      const { seedDatabase } = await import('./seed.js');
      const { sequelize } = await import('../config/database.js');

      console.info('📦 Running migrations...');
      await migrator.up();
      console.info('🌱 Seeding demo tenant...');
      await seedDatabase();
      await sequelize.close();
      console.info('✨ Database reset complete!');
      break;
    }

    default:
      console.error('❌ Unknown command. Available commands: create, drop, reset');
      process.exit(1);
  }
}

const isDirectExecution =
  process.argv[1]?.includes('manage-db') ||
  process.argv[1]?.endsWith('manage-db.ts') ||
  process.argv[1]?.endsWith('manage-db.js');

if (isDirectExecution) {
  runCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Database operation failed:', err);
      process.exit(1);
    });
}
