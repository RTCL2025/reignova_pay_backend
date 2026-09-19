import { sequelize } from '../config/database.js';
import { logger } from '../config/logger.js';
import { seedAdminUsers } from './seeders/index.js';

export async function seedDatabase(): Promise<void> {
  await sequelize.authenticate();

  logger.info('Starting database seeding...');

  // 1. Seed Administrative Users
  logger.info('Seeding Admin User...');
  await seedAdminUsers();

  console.info('\n======================================================');
  console.info('🎉 Database Seeded Successfully with Admin User');
  console.info('======================================================\n');
}

// Check if file is being run directly
const isDirectExecution = process.argv[1]?.includes('seed');
if (isDirectExecution) {
  seedDatabase()
    .then(async () => {
      await sequelize.close();
    })
    .catch(async (err) => {
      console.error('Seeding failed:', err);
      await sequelize.close();
      process.exit(1);
    });
}
