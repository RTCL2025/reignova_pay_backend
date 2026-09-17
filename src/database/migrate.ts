import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from '../config/database.js';
import { logger } from '../config/logger.js';

import * as m1 from './migrations/001-create-applications.js';
import * as m2 from './migrations/002-create-payments.js';
import * as m3 from './migrations/003-create-payment-attempts.js';
import * as m4 from './migrations/004-create-webhook-events.js';
import * as m5 from './migrations/005-create-notifications.js';
import * as m6 from './migrations/006-create-idempotency-keys.js';
import * as m7 from './migrations/007-create-audit-logs.js';

export const migrator = new Umzug({
  migrations: [
    { name: '001-create-applications', ...m1 },
    { name: '002-create-payments', ...m2 },
    { name: '003-create-payment-attempts', ...m3 },
    { name: '004-create-webhook-events', ...m4 },
    { name: '005-create-notifications', ...m5 },
    { name: '006-create-idempotency-keys', ...m6 },
    { name: '007-create-audit-logs', ...m7 }
  ],
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: {
    info: (message: Record<string, unknown> | string) => logger.info({ migration: message }, 'Migration info'),
    warn: (message: Record<string, unknown> | string) => logger.warn({ migration: message }, 'Migration warning'),
    error: (message: Record<string, unknown> | string) => logger.error({ migration: message }, 'Migration error'),
    debug: (message: Record<string, unknown> | string) => logger.debug({ migration: message }, 'Migration debug')
  }
});

async function runCli(): Promise<void> {
  const command = process.argv[2] || 'up';
  try {
    await sequelize.authenticate();
    if (command === 'up') {
      logger.info('Running pending migrations...');
      const executed = await migrator.up();
      logger.info({ count: executed.length }, 'Migrations completed successfully');
      for (const m of executed) {
        console.info(`  ✅ Applied migration: ${m.name}`);
      }
    } else if (command === 'down') {
      logger.info('Reverting last migration...');
      const reverted = await migrator.down();
      logger.info({ count: reverted.length }, 'Revert completed');
      for (const m of reverted) {
        console.info(`  ↩️ Reverted migration: ${m.name}`);
      }
    } else {
      console.error(`Unknown migration command: ${command}. Use 'up' or 'down'.`);
      process.exit(1);
    }
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Check if file is being run directly
const isDirectExecution = process.argv[1]?.includes('migrate');
if (isDirectExecution) {
  runCli();
}
