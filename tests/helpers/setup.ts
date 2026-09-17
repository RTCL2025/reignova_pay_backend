import { sequelize } from '../../src/config/database.js';
import { Application, ApplicationStatus } from '../../src/models/application.model.js';
import { generateApiKey, generateWebhookSecret, hashApiKey } from '../../src/utils/crypto.js';

export async function clearDatabase(): Promise<void> {
  await sequelize.query('TRUNCATE TABLE audit_logs CASCADE;');
  await sequelize.query('TRUNCATE TABLE notifications CASCADE;');
  await sequelize.query('TRUNCATE TABLE webhook_events CASCADE;');
  await sequelize.query('TRUNCATE TABLE payment_attempts CASCADE;');
  await sequelize.query('TRUNCATE TABLE idempotency_keys CASCADE;');
  await sequelize.query('TRUNCATE TABLE payments CASCADE;');
  await sequelize.query('TRUNCATE TABLE applications CASCADE;');
}

export async function createTestApplication(
  name = 'Test SaaS App',
  slug = 'test-saas-app',
  webhookUrl = 'https://webhook.site/test-callback'
): Promise<{ application: Application; apiKey: string; webhookSecret: string }> {
  const { apiKey, prefix } = generateApiKey(false);
  const apiKeyHash = hashApiKey(apiKey);
  const webhookSecret = generateWebhookSecret();

  const application = await Application.create({
    name,
    slug,
    description: 'Test application for automated integration tests',
    apiKeyHash,
    apiKeyPrefix: prefix,
    status: ApplicationStatus.ACTIVE,
    webhookUrl,
    webhookSecret
  });

  return { application, apiKey, webhookSecret };
}
