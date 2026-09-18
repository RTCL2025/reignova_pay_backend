import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { clearDatabase, createTestApplication } from '../helpers/setup.js';
import { sequelize } from '../../src/config/database.js';
import { registerPaymentProvider } from '../../src/services/payment.service.js';
import { mockPaymentProvider } from '../mocks/mock-payment-provider.js';
import { checkoutRepository } from '../../src/repositories/checkout.repository.js';
import { CheckoutStatus } from '../../src/models/checkout.model.js';

describe('Public Hosted Checkout API Endpoints', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    registerPaymentProvider(mockPaymentProvider);
  });

  beforeEach(async () => {
    await clearDatabase();
    mockPaymentProvider.shouldFail = false;
  });

  it('creates checkout session returning publicToken and checkoutUrl', async () => {
    const { apiKey, application } = await createTestApplication('ReignovaEvents', 'reignova-events');

    const res = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-public-chk-1')
      .send({
        reference: 'EVENT-ORDER-1001',
        amount: 25000,
        currency: 'TZS',
        country: 'TZA',
        description: 'Event registration payment',
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+255754123456'
        },
        successUrl: 'https://reignovaevents.com/payment/success',
        cancelUrl: 'https://reignovaevents.com/payment/cancel',
        metadata: { orderId: 'ORDER-1001' }
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reference).toBe('EVENT-ORDER-1001');
    expect(res.body.data.publicToken).toBeDefined();
    expect(res.body.data.publicToken).toMatch(/^cs_sec_[0-9a-f]{48}$/);
    expect(res.body.data.checkoutUrl).toContain(res.body.data.publicToken);
    expect(res.body.data.returnUrl).toBe('https://reignovaevents.com/payment/success');
    expect(res.body.data.cancelUrl).toBe('https://reignovaevents.com/payment/cancel');
  });

  it('retrieves sanitized session details without authentication', async () => {
    const { apiKey } = await createTestApplication('ReignovaEvents', 'reignova-events');

    const createRes = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-public-chk-2')
      .send({
        reference: 'EVENT-ORDER-1002',
        amount: 50000,
        currency: 'TZS',
        country: 'TZA',
        description: 'VIP Ticket',
        customer: {
          name: 'Alice Smith',
          email: 'alice@example.com',
          phone: '+255754000111'
        },
        successUrl: 'https://reignovaevents.com/success',
        cancelUrl: 'https://reignovaevents.com/cancel'
      });

    const publicToken = createRes.body.data.publicToken;

    // Unauthenticated GET call (browser client)
    const publicRes = await request(app).get(`/api/v1/checkouts/public/${publicToken}`);

    expect(publicRes.status).toBe(200);
    expect(publicRes.body.success).toBe(true);
    const session = publicRes.body.data;
    expect(session.publicToken).toBe(publicToken);
    expect(session.reference).toBe('EVENT-ORDER-1002');
    expect(session.amount).toBe(50000);
    expect(session.currency).toBe('TZS');
    expect(session.merchant.name).toBe('ReignovaEvents');
    expect(session.customer.name).toBe('Alice Smith');
    expect(session.customer.email).toBe('alice@example.com');
    expect(session.customer.phone).toBe('+255754000111');
    expect(['PENDING', 'WAITING_PAYMENT']).toContain(session.status);
    expect(session.supportedProviders).toBeInstanceOf(Array);
    expect(session.supportedProviders.length).toBeGreaterThan(0);
    expect(session.supportedProviders[0].id).toBe('VODACOM_TZA');

    // Security check: internal application id and sensitive data must not be leaked
    expect(session.applicationId).toBeUndefined();
    expect(session.apiKeyHash).toBeUndefined();
    expect(session.webhookSecret).toBeUndefined();
  });

  it('returns 404 for unknown or invalid public token', async () => {
    const res = await request(app).get('/api/v1/checkouts/public/cs_sec_invalid_token_12345');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('initiates mobile money payment successfully and transitions checkout to PROCESSING', async () => {
    const { apiKey } = await createTestApplication('ReignovaEvents', 'reignova-events');

    const createRes = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-public-chk-pay')
      .send({
        reference: 'EVENT-ORDER-1003',
        amount: 25000,
        currency: 'TZS',
        country: 'TZA',
        returnUrl: 'https://reignovaevents.com/success'
      });

    const publicToken = createRes.body.data.publicToken;

    // Initiate payment from client
    const payRes = await request(app)
      .post(`/api/v1/checkouts/public/${publicToken}/pay`)
      .send({
        phoneNumber: '0754123456', // TZ national format normalized to +255754123456
        provider: 'VODACOM_TZA',
        customerName: 'John Doe',
        customerEmail: 'john@example.com'
      });

    expect(payRes.status).toBe(202);
    expect(payRes.body.success).toBe(true);
    expect(payRes.body.data.status).toBe('PROCESSING');
    expect(payRes.body.data.depositId).toBeDefined();

    // Verify polling status endpoint
    const statusRes = await request(app).get(`/api/v1/checkouts/public/${publicToken}/status`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('PROCESSING');
    expect(statusRes.body.data.depositStatus).toBe('PROCESSING');
  });

  it('rejects invalid phone number on payment initiation', async () => {
    const { apiKey } = await createTestApplication();

    const createRes = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-public-bad-phone')
      .send({
        reference: 'EVENT-ORDER-BAD-PHONE',
        amount: 10000,
        currency: 'TZS',
        returnUrl: 'https://reignovaevents.com/success'
      });

    const publicToken = createRes.body.data.publicToken;

    const payRes = await request(app)
      .post(`/api/v1/checkouts/public/${publicToken}/pay`)
      .send({
        phoneNumber: 'not-a-phone-number',
        provider: 'VODACOM_TZA'
      });

    expect(payRes.status).toBe(400);
    expect(payRes.body.success).toBe(false);
  });

  it('prevents duplicate payment submissions on already processing checkout', async () => {
    const { apiKey } = await createTestApplication();

    const createRes = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-public-dup-pay')
      .send({
        reference: 'EVENT-ORDER-DUP',
        amount: 15000,
        currency: 'TZS',
        returnUrl: 'https://reignovaevents.com/success'
      });

    const publicToken = createRes.body.data.publicToken;

    // First payment attempt
    const firstPay = await request(app)
      .post(`/api/v1/checkouts/public/${publicToken}/pay`)
      .send({
        phoneNumber: '+255754123456',
        provider: 'VODACOM_TZA'
      });
    expect(firstPay.status).toBe(202);

    // Second payment attempt on same session
    const secondPay = await request(app)
      .post(`/api/v1/checkouts/public/${publicToken}/pay`)
      .send({
        phoneNumber: '+255754123456',
        provider: 'VODACOM_TZA'
      });
    expect(secondPay.status).toBe(409);
    expect(secondPay.body.error.message).toContain('PROCESSING');
  });

  it('updates checkout status to COMPLETED when deposit webhook callback is received', async () => {
    const { apiKey } = await createTestApplication();

    const createRes = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-public-wh-test')
      .send({
        reference: 'EVENT-ORDER-WH-SYNC',
        amount: 30000,
        currency: 'TZS',
        returnUrl: 'https://reignovaevents.com/success'
      });

    const publicToken = createRes.body.data.publicToken;

    const payRes = await request(app)
      .post(`/api/v1/checkouts/public/${publicToken}/pay`)
      .send({
        phoneNumber: '+255754123456',
        provider: 'VODACOM_TZA'
      });

    const depositId = payRes.body.data.depositId;

    // Simulate Pawapay deposit webhook callback
    const callbackRes = await request(app)
      .post('/api/v1/webhooks/pawapay')
      .send({
        depositId,
        status: 'COMPLETED'
      });

    expect(callbackRes.status).toBe(200);

    // Verify polling status endpoint now reflects COMPLETED
    const statusRes = await request(app).get(`/api/v1/checkouts/public/${publicToken}/status`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('COMPLETED');
    expect(statusRes.body.data.depositStatus).toBe('COMPLETED');
    expect(statusRes.body.data.completedAt).toBeDefined();
  });

  it('allows customer to cancel a pending session', async () => {
    const { apiKey } = await createTestApplication();

    const createRes = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-public-cancel')
      .send({
        reference: 'EVENT-ORDER-CANCEL',
        amount: 10000,
        currency: 'TZS',
        returnUrl: 'https://reignovaevents.com/success',
        cancelUrl: 'https://reignovaevents.com/cancel'
      });

    const publicToken = createRes.body.data.publicToken;

    const cancelRes = await request(app).post(`/api/v1/checkouts/public/${publicToken}/cancel`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
    expect(cancelRes.body.data.cancelUrl).toBe('https://reignovaevents.com/cancel');

    // Confirm session status
    const statusRes = await request(app).get(`/api/v1/checkouts/public/${publicToken}/status`);
    expect(statusRes.body.data.status).toBe('CANCELLED');
  });

  it('marks checkout as EXPIRED when session has passed its expiration window', async () => {
    const { apiKey } = await createTestApplication();

    const createRes = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-public-expired')
      .send({
        reference: 'EVENT-ORDER-EXPIRED',
        amount: 20000,
        currency: 'TZS',
        returnUrl: 'https://reignovaevents.com/success'
      });

    const publicToken = createRes.body.data.publicToken;

    // Manually backdate expiresAt in DB
    const checkout = await checkoutRepository.findByPublicToken(publicToken);
    await checkout!.update({ expiresAt: new Date(Date.now() - 60000) });

    // Fetching session should now detect expiration
    const publicRes = await request(app).get(`/api/v1/checkouts/public/${publicToken}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.status).toBe('EXPIRED');

    // Attempting to pay should be rejected
    const payRes = await request(app)
      .post(`/api/v1/checkouts/public/${publicToken}/pay`)
      .send({
        phoneNumber: '+255754123456',
        provider: 'VODACOM_TZA'
      });
    expect(payRes.status).toBe(409); // rejected due to EXPIRED status
  });
});
