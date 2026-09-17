import { Application, ApplicationStatus } from '../models/application.model.js';
import { generateApiKey, generateWebhookSecret, hashApiKey } from '../utils/crypto.js';
import { sequelize } from '../config/database.js';
import { logger } from '../config/logger.js';

export async function seedDatabase(): Promise<{
  application: Application;
  rawApiKey: string;
}> {
  await sequelize.authenticate();

  const slug = 'reignova-events';
  const existingApp = await Application.findOne({ where: { slug } });

  if (existingApp) {
    logger.info({ slug }, 'Demo application already exists in database');
    console.info(`\nℹ️  Application '${slug}' already exists with ID: ${existingApp.id}`);
    return { application: existingApp, rawApiKey: '[ALREADY_CONFIGURED]' };
  }

  const { apiKey, prefix } = generateApiKey(false);
  const apiKeyHash = hashApiKey(apiKey);
  const webhookSecret = generateWebhookSecret();

  const application = await Application.create({
    name: 'ReignovaEvents',
    slug,
    description: 'Event ticketing and registration SaaS platform',
    apiKeyHash,
    apiKeyPrefix: prefix,
    status: ApplicationStatus.ACTIVE,
    webhookUrl: 'https://events.example.com/api/webhooks/payments',
    webhookSecret
  });

  logger.info({ applicationId: application.id }, 'Demo application seeded successfully');

  console.info('\n======================================================');
  console.info('🎉 Demo Application Seeded Successfully:');
  console.info('------------------------------------------------------');
  console.info(`Name:           ${application.name}`);
  console.info(`Slug:           ${application.slug}`);
  console.info(`ID:             ${application.id}`);
  console.info(`API Key:        ${apiKey}`);
  console.info(`Webhook Secret: ${webhookSecret}`);
  console.info('------------------------------------------------------');
  console.info('⚠️  SAVE THIS API KEY! It will NOT be shown again.');
  console.info('======================================================\n');

  return { application, rawApiKey: apiKey };
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
