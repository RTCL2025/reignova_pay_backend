import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { clearDatabase, createTestApplication } from '../helpers/setup.js';
import { sequelize } from '../../src/config/database.js';
import { registerPaymentProvider } from '../../src/services/payment.service.js';
import { mockPaymentProvider } from '../mocks/mock-payment-provider.js';

describe('Refund Lifecycle & Integration', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    registerPaymentProvider(mockPaymentProvider);
  });

  beforeEach(async () => {
    await clearDatabase();
    mockPaymentProvider.shouldFail = false;
    mockPaymentProvider.customStatus = 'ACCEPTED';
  });

  it('rejects unauthenticated requests to refunds endpoint', async () => {
    const res = await request(app)
      .post('/api/v1/refunds')
      .set('Idempotency-Key', 'test-refund-1')
      .send({
        depositPaymentId: 'e123b810-9dad-11d1-80b4-00c04fd430c8',
        reference: 'REFUND-001'
      });

    expect(res.status).toBe(401);
  });

  it('prevents refunding a deposit that is not COMPLETED', async () => {
    const { apiKey } = await createTestApplication();

    // Create deposit (which starts in PROCESSING status)
    const depositRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-deposit-for-refund-1')
      .send({
        reference: 'ORDER-FOR-REFUND-1',
        amount: 20000,
        currency: 'TZS',
        phoneNumber: '+255754123456',
        country: 'TZ'
      });

    const depositId = depositRes.body.data.id;

    // Attempt refund while PROCESSING
    const refundRes = await request(app)
      .post('/api/v1/refunds')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-refund-early')
      .send({
        depositPaymentId: depositId,
        reference: 'REFUND-EARLY',
        amount: 10000
      });

    expect(refundRes.status).toBe(400);
    expect(refundRes.body.error.message).toContain('Only COMPLETED payments can be refunded');
  });

  it('creates refund on completed deposit and validates amount constraints', async () => {
    const { apiKey } = await createTestApplication();

    // 1. Create deposit
    const depositRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-deposit-to-complete')
      .send({
        reference: 'ORDER-COMPLETE-1',
        amount: 50000,
        currency: 'TZS',
        phoneNumber: '+255754123456',
        country: 'TZ'
      });

    const depositId = depositRes.body.data.id;

    // 2. Complete deposit via webhook callback
    await request(app)
      .post('/api/v1/webhooks/pawapay')
      .send({
        depositId,
        status: 'COMPLETED',
        providerTransactionId: 'ptx_deposit_completed'
      });

    // 3. Attempt refund exceeding amount (60,000 > 50,000)
    const excessRefundRes = await request(app)
      .post('/api/v1/refunds')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-refund-excess')
      .send({
        depositPaymentId: depositId,
        reference: 'REFUND-EXCESS',
        amount: 60000
      });

    expect(excessRefundRes.status).toBe(400);
    expect(excessRefundRes.body.error.message).toContain('exceeds maximum refundable amount');

    // 4. Create first partial refund (20,000)
    const partial1Res = await request(app)
      .post('/api/v1/refunds')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-refund-part1')
      .send({
        depositPaymentId: depositId,
        reference: 'REFUND-PART-1',
        amount: 20000
      });

    expect(partial1Res.status).toBe(202);
    expect(partial1Res.body.data.type).toBe('REFUND');
    expect(partial1Res.body.data.originalPaymentId).toBe(depositId);
    expect(partial1Res.body.data.amount).toBe(20000);

    // Complete first partial refund
    await request(app)
      .post('/api/v1/webhooks/pawapay/refunds')
      .send({
        refundId: partial1Res.body.data.id,
        depositId,
        status: 'COMPLETED'
      });

    // 5. Attempt second partial refund for 40,000 (remaining is only 30,000)
    const excessPart2Res = await request(app)
      .post('/api/v1/refunds')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-refund-part2-excess')
      .send({
        depositPaymentId: depositId,
        reference: 'REFUND-PART2-EXCESS',
        amount: 40000
      });

    expect(excessPart2Res.status).toBe(400);
    expect(excessPart2Res.body.error.message).toContain('exceeds maximum refundable amount');

    // 6. Create valid second partial refund for remaining 30,000
    const partial2Res = await request(app)
      .post('/api/v1/refunds')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-refund-part2-ok')
      .send({
        depositPaymentId: depositId,
        reference: 'REFUND-PART-2',
        amount: 30000
      });

    expect(partial2Res.status).toBe(202);
    expect(partial2Res.body.data.amount).toBe(30000);
  });

  it('processes Pawapay refund webhook callback and transitions status to COMPLETED', async () => {
    const { apiKey } = await createTestApplication();

    // Create & complete deposit
    const depositRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-deposit-for-wh-refund')
      .send({
        reference: 'ORDER-FOR-WH-REFUND',
        amount: 10000,
        currency: 'TZS',
        phoneNumber: '+255754123456',
        country: 'TZ'
      });

    const depositId = depositRes.body.data.id;

    await request(app)
      .post('/api/v1/webhooks/pawapay')
      .send({
        depositId,
        status: 'COMPLETED'
      });

    // Create refund
    const refundRes = await request(app)
      .post('/api/v1/refunds')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('Idempotency-Key', 'idem-refund-for-wh')
      .send({
        depositPaymentId: depositId,
        reference: 'REFUND-WH-TEST',
        amount: 10000
      });

    const refundId = refundRes.body.data.id;

    // Send refund webhook callback
    const callbackRes = await request(app)
      .post('/api/v1/webhooks/pawapay/refunds')
      .send({
        refundId,
        depositId,
        status: 'COMPLETED'
      });

    expect(callbackRes.status).toBe(200);

    const verifyRes = await request(app)
      .get(`/api/v1/refunds/${refundId}`)
      .set('Authorization', `Bearer ${apiKey}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('COMPLETED');
  });
});
