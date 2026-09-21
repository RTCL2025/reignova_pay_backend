import { sequelize } from '../../src/config/database.js';
import { Application, ApplicationStatus } from '../../src/models/application.model.js';
import { generateApiKey, generateWebhookSecret, hashApiKey } from '../../src/utils/crypto.js';

export async function clearDatabase(): Promise<void> {
  await sequelize.query('TRUNCATE TABLE reignova_pay.admin_users CASCADE;');
  await sequelize.query('TRUNCATE TABLE reignova_pay.audit_logs CASCADE;');
  await sequelize.query('TRUNCATE TABLE reignova_pay.notifications CASCADE;');
  await sequelize.query('TRUNCATE TABLE reignova_pay.webhook_events CASCADE;');
  await sequelize.query('TRUNCATE TABLE reignova_pay.payment_attempts CASCADE;');
  await sequelize.query('TRUNCATE TABLE reignova_pay.idempotency_keys CASCADE;');
  await sequelize.query('TRUNCATE TABLE reignova_pay.checkouts CASCADE;');
  await sequelize.query('TRUNCATE TABLE reignova_pay.payments CASCADE;');
  await sequelize.query('TRUNCATE TABLE reignova_pay.applications CASCADE;');
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
