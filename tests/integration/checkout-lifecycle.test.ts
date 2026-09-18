import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { clearDatabase, createTestApplication } from '../helpers/setup.js';
import { sequelize } from '../../src/config/database.js';
import { registerPaymentProvider } from '../../src/services/payment.service.js';
import { mockPaymentProvider } from '../mocks/mock-payment-provider.js';

describe('Checkout Lifecycle & Integration', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    registerPaymentProvider(mockPaymentProvider);
  });

  beforeEach(async () => {
    await clearDatabase();
    mockPaymentProvider.shouldFail = false;
  });

  it('rejects unauthenticated requests to checkouts endpoint', async () => {
    const res = await request(app)
      .post('/api/v1/checkouts')
      .set('Idempotency-Key', 'test-chk-1')
      .send({
        reference: 'CHK-001',
        returnUrl: 'https://myshop.com/return'
      });

    expect(res.status).toBe(401);
  });

  it('rejects checkout request without returnUrl (per Pawapay API spec)', async () => {
    const { apiKey } = await createTestApplication();

    const res = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-chk-no-url')
      .send({
        reference: 'CHK-NO-URL'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Request validation failed');
    expect(JSON.stringify(res.body.error.details)).toContain('returnUrl');
  });

  it('creates checkout session and receives redirectUrl and checkoutCode', async () => {
    const { apiKey, application } = await createTestApplication();

    const res = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-chk-1001')
      .send({
        reference: 'CHK-1001',
        returnUrl: 'https://myshop.com/success',
        returnMethod: 'POST',
        defaultLanguage: 'en',
        countries: ['TZ', 'ZM'],
        amounts: [
          { country: 'TZ', currency: 'TZS', amount: 50000 },
          { country: 'ZM', currency: 'ZMW', amount: 500 }
        ],
        payer: {
          phoneNumber: '255754123456',
          allowCustomerToOverride: true
        },
        expiresAfter: 20
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reference).toBe('CHK-1001');
    expect(res.body.data.applicationId).toBe(application.id);
    expect(res.body.data.status).toBe('WAITING_PAYMENT');
    expect(res.body.data.redirectUrl).toContain('https://checkout.sandbox.pawapay.cloud/');
    expect(res.body.data.checkoutCode).toBe('CHK123456');
    expect(res.body.data.returnUrl).toBe('https://myshop.com/success');
  });

  it('replays identical response on duplicate request with same Idempotency-Key', async () => {
    const { apiKey } = await createTestApplication();
    const payload = {
      reference: 'CHK-1002',
      returnUrl: 'https://myshop.com/complete'
    };

    const firstRes = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-chk-1002')
      .send(payload);

    expect(firstRes.status).toBe(201);

    const secondRes = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-chk-1002')
      .send(payload);

    expect(secondRes.status).toBe(201);
    expect(secondRes.headers['idempotency-replayed']).toBe('true');
    expect(secondRes.body.data.id).toBe(firstRes.body.data.id);
  });

  it('retrieves checkout by ID and by checkoutCode', async () => {
    const { apiKey } = await createTestApplication();

    const createRes = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-chk-query')
      .send({
        reference: 'CHK-QUERY',
        returnUrl: 'https://myshop.com/order-result'
      });

    const checkoutId = createRes.body.data.id;
    const checkoutCode = createRes.body.data.checkoutCode;

    const byIdRes = await request(app)
      .get(`/api/v1/checkouts/${checkoutId}`)
      .set('Authorization', `Bearer ${apiKey}`);

    expect(byIdRes.status).toBe(200);
    expect(byIdRes.body.data.id).toBe(checkoutId);
    expect(byIdRes.body.data.reference).toBe('CHK-QUERY');

    const byCodeRes = await request(app)
      .get(`/api/v1/checkouts/code/${checkoutCode}`)
      .set('Authorization', `Bearer ${apiKey}`);

    expect(byCodeRes.status).toBe(200);
    expect(byCodeRes.body.data.id).toBe(checkoutId);
  });

  it('expires a pending checkout session', async () => {
    const { apiKey } = await createTestApplication();

    const createRes = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-chk-to-expire')
      .send({
        reference: 'CHK-EXPIRE-TEST',
        returnUrl: 'https://myshop.com/order-result'
      });

    const checkoutId = createRes.body.data.id;

    const expireRes = await request(app)
      .post(`/api/v1/checkouts/${checkoutId}/expire`)
      .set('Authorization', `Bearer ${apiKey}`);

    expect(expireRes.status).toBe(200);
    expect(expireRes.body.data.status).toBe('EXPIRED');
    expect(expireRes.body.data.expiredAt).toBeDefined();
  });

  it('processes Pawapay checkout webhook callback and updates status to COMPLETED', async () => {
    const { apiKey } = await createTestApplication();

    const createRes = await request(app)
      .post('/api/v1/checkouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-chk-wh')
      .send({
        reference: 'CHK-WH-TEST',
        returnUrl: 'https://myshop.com/wh-result'
      });

    const checkoutId = createRes.body.data.id;

    const callbackRes = await request(app)
      .post('/api/v1/webhooks/pawapay/checkouts')
      .send({
        checkoutId,
        status: 'COMPLETED',
        deposit: {
          depositId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          status: 'COMPLETED',
          amount: '50000',
          currency: 'TZS'
        }
      });

    expect(callbackRes.status).toBe(200);
    expect(callbackRes.body.success).toBe(true);

    const verifyRes = await request(app)
      .get(`/api/v1/checkouts/${checkoutId}`)
      .set('Authorization', `Bearer ${apiKey}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('COMPLETED');
    expect(verifyRes.body.data.depositId).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  });
});
