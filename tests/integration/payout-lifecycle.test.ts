import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { clearDatabase, createTestApplication } from '../helpers/setup.js';
import { sequelize } from '../../src/config/database.js';
import { registerPaymentProvider } from '../../src/services/payment.service.js';
import { mockPaymentProvider } from '../mocks/mock-payment-provider.js';

describe('Payout Lifecycle & Integration', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    registerPaymentProvider(mockPaymentProvider);
  });

  beforeEach(async () => {
    await clearDatabase();
    mockPaymentProvider.shouldFail = false;
    mockPaymentProvider.customStatus = 'ACCEPTED';
  });

  it('rejects unauthenticated requests to payouts endpoint', async () => {
    const res = await request(app)
      .post('/api/v1/payouts')
      .set('Idempotency-Key', 'test-payout-1')
      .send({
        reference: 'PAYOUT-001',
        amount: 25000,
        currency: 'TZS',
        phoneNumber: '+255754123456',
        country: 'TZ'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects payout request without Idempotency-Key header', async () => {
    const { apiKey } = await createTestApplication();

    const res = await request(app)
      .post('/api/v1/payouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({
        reference: 'PAYOUT-001',
        amount: 25000,
        currency: 'TZS',
        phoneNumber: '+255754123456',
        country: 'TZ'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Idempotency-Key header is required');
  });

  it('creates payout and initiates provider processing', async () => {
    const { apiKey, application } = await createTestApplication();

    const res = await request(app)
      .post('/api/v1/payouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-payout-1001')
      .send({
        reference: 'PAYOUT-1001',
        amount: 35000,
        currency: 'TZS',
        phoneNumber: '+255754123456',
        country: 'TZ',
        provider: 'VODACOM_TZA',
        customerMessage: 'Bonus payment',
        description: 'Employee bonus'
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reference).toBe('PAYOUT-1001');
    expect(res.body.data.type).toBe('PAYOUT');
    expect(res.body.data.status).toBe('PROCESSING');
    expect(res.body.data.applicationId).toBe(application.id);
    expect(res.body.data.amount).toBe(35000);
    expect(res.body.data.customerMessage).toBe('Bonus payment');
  });

  it('replays identical response on duplicate request with same Idempotency-Key', async () => {
    const { apiKey } = await createTestApplication();
    const payload = {
      reference: 'PAYOUT-1002',
      amount: 15000,
      currency: 'TZS',
      phoneNumber: '+255754123456',
      country: 'TZ'
    };

    const firstRes = await request(app)
      .post('/api/v1/payouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-payout-1002')
      .send(payload);

    expect(firstRes.status).toBe(202);

    const secondRes = await request(app)
      .post('/api/v1/payouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-payout-1002')
      .send(payload);

    expect(secondRes.status).toBe(202);
    expect(secondRes.headers['idempotency-replayed']).toBe('true');
    expect(secondRes.body.data.id).toBe(firstRes.body.data.id);
  });

  it('retrieves payout by ID and Reference and lists with type filter', async () => {
    const { apiKey } = await createTestApplication();

    const createRes = await request(app)
      .post('/api/v1/payouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-payout-1003')
      .send({
        reference: 'PAYOUT-1003',
        amount: 20000,
        currency: 'TZS',
        phoneNumber: '+255754123456',
        country: 'TZ'
      });

    const payoutId = createRes.body.data.id;

    const byIdRes = await request(app)
      .get(`/api/v1/payouts/${payoutId}`)
      .set('Authorization', `Bearer ${apiKey}`);

    expect(byIdRes.status).toBe(200);
    expect(byIdRes.body.data.id).toBe(payoutId);
    expect(byIdRes.body.data.type).toBe('PAYOUT');

    const byRefRes = await request(app)
      .get('/api/v1/payouts/reference/PAYOUT-1003')
      .set('Authorization', `Bearer ${apiKey}`);

    expect(byRefRes.status).toBe(200);
    expect(byRefRes.body.data.reference).toBe('PAYOUT-1003');

    const listRes = await request(app)
      .get('/api/v1/payouts')
      .set('Authorization', `Bearer ${apiKey}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);
    expect(listRes.body.data[0].type).toBe('PAYOUT');
  });

  it('processes Pawapay payout webhook callback and transitions status to COMPLETED', async () => {
    const { apiKey } = await createTestApplication();

    const createRes = await request(app)
      .post('/api/v1/payouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-payout-webhook')
      .send({
        reference: 'PAYOUT-WEBHOOK',
        amount: 50000,
        currency: 'TZS',
        phoneNumber: '+255754123456',
        country: 'TZ'
      });

    const payoutId = createRes.body.data.id;

    const callbackRes = await request(app)
      .post('/api/v1/webhooks/pawapay/payouts')
      .send({
        payoutId,
        status: 'COMPLETED',
        amount: '50000',
        currency: 'TZS',
        recipient: {
          type: 'MMO',
          accountDetails: {
            phoneNumber: '255754123456',
            provider: 'VODACOM_TZA'
          }
        },
        providerTransactionId: 'ptx_payout_success_1'
      });

    expect(callbackRes.status).toBe(200);
    expect(callbackRes.body.success).toBe(true);

    const verifyRes = await request(app)
      .get(`/api/v1/payouts/${payoutId}`)
      .set('Authorization', `Bearer ${apiKey}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('COMPLETED');
  });

  it('multiplexes payout callback sent to root /api/v1/webhooks/pawapay endpoint', async () => {
    const { apiKey } = await createTestApplication();

    const createRes = await request(app)
      .post('/api/v1/payouts')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-payout-wh-multi')
      .send({
        reference: 'PAYOUT-WH-MULTI-TEST',
        amount: 30000,
        currency: 'TZS',
        phoneNumber: '+255754123456',
        country: 'TZ'
      });

    const payoutId = createRes.body.data.id;

    const callbackRes = await request(app)
      .post('/api/v1/webhooks/pawapay')
      .send({
        payoutId,
        status: 'COMPLETED',
        amount: '30000',
        currency: 'TZS',
        recipient: {
          type: 'MMO',
          accountDetails: {
            phoneNumber: '255754123456',
            provider: 'VODACOM_TZA'
          }
        },
        providerTransactionId: 'ptx_payout_multi_1'
      });

    expect(callbackRes.status).toBe(200);
    expect(callbackRes.body.success).toBe(true);

    const verifyRes = await request(app)
      .get(`/api/v1/payouts/${payoutId}`)
      .set('Authorization', `Bearer ${apiKey}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('COMPLETED');
  });
});
