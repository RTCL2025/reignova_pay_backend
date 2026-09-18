import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { clearDatabase, createTestApplication } from '../helpers/setup.js';
import { sequelize } from '../../src/config/database.js';
import { registerPaymentProvider } from '../../src/services/payment.service.js';
import { mockPaymentProvider } from '../mocks/mock-payment-provider.js';
import { Notification } from '../../src/models/notification.model.js';

describe('Payment Lifecycle & Multi-Tenant Isolation (Integration)', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    // Set mock provider for reliable integration testing
    registerPaymentProvider(mockPaymentProvider);
  });

  beforeEach(async () => {
    await clearDatabase();
    mockPaymentProvider.shouldFail = false;
    mockPaymentProvider.customStatus = 'ACCEPTED';
  });

  it('rejects unauthenticated requests to payments endpoint', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Idempotency-Key', 'test-key-1')
      .send({
        reference: 'REF-001',
        amount: 50000,
        currency: 'TZS',
        phoneNumber: '+255700000000',
        country: 'TZ'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects payment request without Idempotency-Key header', async () => {
    const { apiKey } = await createTestApplication();

    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({
        reference: 'REF-001',
        amount: 50000,
        currency: 'TZS',
        phoneNumber: '+255700000000',
        country: 'TZ'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Idempotency-Key header is required');
  });

  it('creates payment deposit and initiates provider processing', async () => {
    const { apiKey, application } = await createTestApplication();

    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-1001')
      .send({
        reference: 'ORDER-1001',
        amount: 25000,
        currency: 'TZS',
        phoneNumber: '+255700000000',
        country: 'TZ',
        provider: 'VODACOM_TZA',
        description: 'VIP Ticket'
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reference).toBe('ORDER-1001');
    expect(res.body.data.status).toBe('PROCESSING');
    expect(res.body.data.applicationId).toBe(application.id);
    expect(res.body.data.amount).toBe(25000);
  });

  it('replays identical response on duplicate request with same Idempotency-Key', async () => {
    const { apiKey } = await createTestApplication();
    const payload = {
      reference: 'ORDER-1002',
      amount: 15000,
      currency: 'TZS',
      phoneNumber: '+255700000000',
      country: 'TZ'
    };

    // First request
    const firstRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-1002')
      .send(payload);

    expect(firstRes.status).toBe(202);

    // Second request with exact same idempotency key and body
    const secondRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-1002')
      .send(payload);

    expect(secondRes.status).toBe(202);
    expect(secondRes.headers['idempotency-replayed']).toBe('true');
    expect(secondRes.body.data.id).toBe(firstRes.body.data.id);
  });

  it('prevents duplicate payment reference within the same application', async () => {
    const { apiKey } = await createTestApplication();

    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-2001')
      .send({
        reference: 'DUPLICATE-REF',
        amount: 10000,
        currency: 'TZS',
        phoneNumber: '+255700000000',
        country: 'TZ'
      });

    const duplicateRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-2002') // Different idempotency key, same reference
      .send({
        reference: 'DUPLICATE-REF',
        amount: 10000,
        currency: 'TZS',
        phoneNumber: '+255700000000',
        country: 'TZ'
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error.code).toBe('CONFLICT');
  });

  it('enforces multi-tenant isolation: App B cannot view or access App A payments', async () => {
    const appA = await createTestApplication('App A', 'app-a');
    const appB = await createTestApplication('App B', 'app-b');

    // App A creates payment
    const createRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${appA.apiKey}`)
      .set('Idempotency-Key', 'app-a-key-1')
      .send({
        reference: 'SHARED-REF-NAME',
        amount: 5000,
        currency: 'TZS',
        phoneNumber: '+255700000000',
        country: 'TZ'
      });

    const paymentAId = createRes.body.data.id;

    // App B can use the same reference because references are scoped per-application
    const appBRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${appB.apiKey}`)
      .set('Idempotency-Key', 'app-b-key-1')
      .send({
        reference: 'SHARED-REF-NAME',
        amount: 7000,
        currency: 'TZS',
        phoneNumber: '+255700000000',
        country: 'TZ'
      });

    expect(appBRes.status).toBe(202);

    // App B attempts to query App A's payment by ID -> MUST return 404 NOT_FOUND
    const crossQueryRes = await request(app)
      .get(`/api/v1/payments/${paymentAId}`)
      .set('Authorization', `Bearer ${appB.apiKey}`);

    expect(crossQueryRes.status).toBe(404);

    // App A can query its own payment
    const ownQueryRes = await request(app)
      .get(`/api/v1/payments/${paymentAId}`)
      .set('Authorization', `Bearer ${appA.apiKey}`);

    expect(ownQueryRes.status).toBe(200);
    expect(ownQueryRes.body.data.id).toBe(paymentAId);
  });

  it('processes Pawapay webhook callback, transitions status to COMPLETED, and schedules notification', async () => {
    const { apiKey } = await createTestApplication();

    // 1. Create initial deposit
    const createRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'webhook-test-1')
      .send({
        reference: 'ORDER-WEBHOOK-1',
        amount: 30000,
        currency: 'TZS',
        phoneNumber: '+255700000000',
        country: 'TZ'
      });

    const paymentId = createRes.body.data.id;

    // 2. Simulate incoming Pawapay callback for this deposit
    const webhookRes = await request(app)
      .post('/api/v1/webhooks/pawapay')
      .send({
        depositId: paymentId,
        status: 'COMPLETED',
        requestedAmount: '30000.00',
        amount: '30000.00',
        currency: 'TZS',
        country: 'TZA',
        providerTransactionId: 'ptx_pawapay_success_999'
      });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.success).toBe(true);

    // 3. Verify payment is now COMPLETED via GET
    const verifyRes = await request(app)
      .get(`/api/v1/payments/${paymentId}`)
      .set('Authorization', `Bearer ${apiKey}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('COMPLETED');
    expect(verifyRes.body.data.completedAt).toBeDefined();

    // 4. Verify notification record was created for SaaS application
    const notifications = await Notification.findAll({ where: { paymentId } });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    const completedNotification = notifications.find((n) => n.eventType === 'payment.completed');
    expect(completedNotification).toBeDefined();
    expect(completedNotification?.payload).toHaveProperty('event', 'payment.completed');

    // 5. Send duplicate webhook -> safely acknowledged without error
    const duplicateWebhookRes = await request(app)
      .post('/api/v1/webhooks/pawapay')
      .send({
        depositId: paymentId,
        status: 'COMPLETED',
        requestedAmount: '30000.00',
        currency: 'TZS',
        country: 'TZA'
      });

    expect(duplicateWebhookRes.status).toBe(200);
    expect(duplicateWebhookRes.body.data.duplicate).toBe(true);
  });
});
