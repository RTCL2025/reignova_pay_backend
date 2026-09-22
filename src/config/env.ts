import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file into process.env before validation
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Admin authentication (Option 1 - Admin API Key)
  ADMIN_API_KEY: z.string().min(8, 'ADMIN_API_KEY must be at least 8 characters long'),

  // Pepper used for hashing client API keys
  API_KEY_PEPPER: z.string().min(8, 'API_KEY_PEPPER must be at least 8 characters long'),

  // Database settings
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('payment_service'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_SSL: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(10),

  // Pawapay integration
  PAWAPAY_BASE_URL: z.string().url().default('https://api.sandbox.pawapay.cloud'),
  PAWAPAY_API_TOKEN: z.string().min(1, 'PAWAPAY_API_TOKEN is required'),
  PAWAPAY_REQUEST_TIMEOUT_MS: z.coerce.number().default(15000),
  PAWAPAY_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  PAWAPAY_AUTO_PREDICT_PROVIDER: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  PAWAPAY_VERIFY_CALLBACK_SIGNATURES: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Notification & Email delivery
  NOTIFICATION_TIMEOUT_MS: z.coerce.number().default(10000),
  NOTIFICATION_MAX_RETRIES: z.coerce.number().default(5),
  NOTIFICATION_POLL_INTERVAL_MS: z.coerce.number().default(30000),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('Reignova Receipts <receipts@reignovatechnologies.com>'),

  // Security & Rate limits
  CORS_ORIGIN: z.string().default('*'),
  // Origin of the hosted checkout UI. Builds the customer-facing link
  // `${CHECKOUT_BASE_URL}/checkout/${publicToken}` in checkout.service.ts.
  CHECKOUT_BASE_URL: z.string().url().default('https://pay.reignovatechnologies.com'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_PUBLIC_MAX: z.coerce.number().default(60),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(600),
  RATE_LIMIT_WEBHOOK_MAX: z.coerce.number().default(300)
});

export type EnvConfig = z.infer<typeof envSchema>;

function parseEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    console.error(`\n❌ Invalid environment configuration:\n${errorDetails}\n`);
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
export default env;
