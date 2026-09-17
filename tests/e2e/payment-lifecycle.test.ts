import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { sequelize } from '../../src/config/database.js';
import { clearDatabase } from '../helpers/setup.js';
import { registerPaymentProvider } from '../../src/services/payment.service.js';
import { mockPaymentProvider } from '../mocks/mock-payment-provider.js';
import { Notification } from '../../src/models/notification.model.js';
import { PaymentStatus } from '../../src/models/payment.model.js';

describe('Payment Service End-to-End Test Suite', () => {
  const adminKey = env.ADMIN_API_KEY;
  let saasAppId: string;
  let saasApiKey: string;
  let saasWebhookSecret: string;
  let paymentId: string;

  beforeAll(async () => {
    await sequelize.authenticate();
    await clearDatabase();
    registerPaymentProvider(mockPaymentProvider);
  });

  // Step 1: Health & Docs Checks
  it('1. Liveness and readiness endpoints return 200 OK', async () => {
    const livenessRes = await request(app).get('/health');
    expect(livenessRes.status).toBe(200);
    expect(livenessRes.body.status).toBe('ok');

    const readinessRes = await request(app).get('/health/ready');
    expect(readinessRes.status).toBe(200);
    expect(readinessRes.body.status).toBe('ready');
    expect(readinessRes.body.database).toBe('connected');
  });

  it('2. OpenAPI documentation endpoint is reachable at /docs', async () => {
    const docsRes = await request(app).get('/docs/');
    // Swagger UI returns 200 HTML or redirect to trailing slash
    expect([200, 301, 302]).toContain(docsRes.status);
  });

  // Step 2: SaaS Application Onboarding (Admin)
  it('3. Admin registers a new SaaS application and receives API Key & Webhook Secret', async () => {
    const res = await request(app)
      .post('/api/v1/admin/applications')
      .set('Admin-Api-Key', adminKey)
      .send({
        name: 'ReignovaEvents E2E',
        slug: 'reignova-events-e2e',
        description: 'Ticketing Platform',
        webhookUrl: 'https://webhook.site/reignova-test-receiver'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    saasAppId = res.body.data.application.id;
    saasApiKey = res.body.data.apiKey;
    saasWebhookSecret = res.body.data.webhookSecret;

    expect(saasAppId).toBeDefined();
    expect(saasApiKey).toMatch(/^pk_live_[0-9a-f]{64}$/);
    expect(saasWebhookSecret).toMatch(/^whsec_[0-9a-f]{64}$/);
  });

  // Step 3: Deposit Initiation
  it('4. SaaS product initiates a mobile-money deposit with Idempotency-Key', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${saasApiKey}`)
      .set('Idempotency-Key', 'e2e-order-10001')
      .send({
        reference: 'TICKET-E2E-10001',
        amount: 45000,
        currency: 'TZS',
        phoneNumber: '+255700000000',
        country: 'TZ',
        description: 'Early Bird Ticket VIP',
        metadata: {
          eventId: 'reignova-fest-2026',
          attendeeEmail: 'user@example.com'
        }
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(PaymentStatus.PROCESSING);
    expect(res.body.data.reference).toBe('TICKET-E2E-10001');
    expect(res.body.data.amount).toBe(45000);
    expect(res.body.data.currency).toBe('TZS');

    paymentId = res.body.data.id;
    expect(paymentId).toBeDefined();
  });

  // Step 4: Idempotency Replay
  it('5. Replaying exact deposit request with same Idempotency-Key returns cached response', async () => {
    const replayRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${saasApiKey}`)
      .set('Idempotency-Key', 'e2e-order-10001')
      .send({
        reference: 'TICKET-E2E-10001',
        amount: 45000,
        currency: 'TZS',
        phoneNumber: '+255700000000',
        country: 'TZ',
        description: 'Early Bird Ticket VIP',
        metadata: {
          eventId: 'reignova-fest-2026',
          attendeeEmail: 'user@example.com'
        }
      });

    expect(replayRes.status).toBe(202);
    expect(replayRes.headers['idempotency-replayed']).toBe('true');
    expect(replayRes.body.data.id).toBe(paymentId);
  });

  // Step 5: Payment Retrieval by ID & Reference
  it('6. SaaS product can retrieve payment by ID and by Reference', async () => {
    const byIdRes = await request(app)
      .get(`/api/v1/payments/${paymentId}`)
      .set('Authorization', `Bearer ${saasApiKey}`);

    expect(byIdRes.status).toBe(200);
    expect(byIdRes.body.data.id).toBe(paymentId);

    const byRefRes = await request(app)
      .get('/api/v1/payments/reference/TICKET-E2E-10001')
      .set('Authorization', `Bearer ${saasApiKey}`);

    expect(byRefRes.status).toBe(200);
    expect(byRefRes.body.data.reference).toBe('TICKET-E2E-10001');
  });

  // Step 6: Paginated Payment List
  it('7. SaaS product can list payments with pagination and filters', async () => {
    const listRes = await request(app)
      .get('/api/v1/payments?page=1&limit=10&status=PROCESSING')
      .set('Authorization', `Bearer ${saasApiKey}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.meta).toHaveProperty('total');
    expect(listRes.body.meta).toHaveProperty('totalPages');
  });

  // Step 7: Webhook Status Update (ACCEPTED -> COMPLETED)
  it('8. Pawapay callback transitions payment to COMPLETED and generates signed notification', async () => {
    const callbackRes = await request(app)
      .post('/api/v1/webhooks/pawapay')
      .send({
        depositId: paymentId,
        status: 'COMPLETED',
        requestedAmount: '45000.00',
        amount: '45000.00',
        currency: 'TZS',
        country: 'TZA',
        providerTransactionId: 'ptx_e2e_successful_9999'
      });

    expect(callbackRes.status).toBe(200);
    expect(callbackRes.body.success).toBe(true);

    // Verify payment updated to COMPLETED
    const verifyRes = await request(app)
      .get(`/api/v1/payments/${paymentId}`)
      .set('Authorization', `Bearer ${saasApiKey}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('COMPLETED');
    expect(verifyRes.body.data.completedAt).toBeDefined();

    // Verify notification was created with signed payload
    const notifications = await Notification.findAll({ where: { paymentId } });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    const completedNotification = notifications.find((n) => n.eventType === 'payment.completed');
    expect(completedNotification).toBeDefined();
    expect(completedNotification?.callbackUrl).toBe('https://webhook.site/reignova-test-receiver');
  });

  // Step 8: Duplicate Webhook Handling
  it('9. Replaying duplicate Pawapay callback is safely acknowledged without duplicate state change', async () => {
    const duplicateRes = await request(app)
      .post('/api/v1/webhooks/pawapay')
      .send({
        depositId: paymentId,
        status: 'COMPLETED',
        requestedAmount: '45000.00',
        amount: '45000.00',
        currency: 'TZS',
        country: 'TZA',
        providerTransactionId: 'ptx_e2e_successful_9999'
      });

    expect(duplicateRes.status).toBe(200);
    expect(duplicateRes.body.data.duplicate).toBe(true);
  });

  // Step 9: Multi-Tenant Cross-Access Isolation
  it('10. Second SaaS product cannot access first SaaS product payments (Tenant Isolation)', async () => {
    const appBRes = await request(app)
      .post('/api/v1/admin/applications')
      .set('Admin-Api-Key', adminKey)
      .send({
        name: 'Another SaaS Platform',
        slug: 'another-saas-platform'
      });

    const secondAppApiKey = appBRes.body.data.apiKey;

    // Second app attempts to query paymentId owned by first app
    const forbiddenQueryRes = await request(app)
      .get(`/api/v1/payments/${paymentId}`)
      .set('Authorization', `Bearer ${secondAppApiKey}`);

    // Must return 404 NOT_FOUND so it cannot even discover existence of payment
    expect(forbiddenQueryRes.status).toBe(404);
  });
});
