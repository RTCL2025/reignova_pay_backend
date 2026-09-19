import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { clearDatabase } from '../helpers/setup.js';
import { sequelize } from '../../src/config/database.js';
import { Application, ApplicationStatus } from '../../src/models/application.model.js';
import { Payment, PaymentType, PaymentStatus } from '../../src/models/payment.model.js';
import { Checkout, CheckoutStatus } from '../../src/models/checkout.model.js';
import { AuditLog } from '../../src/models/audit-log.model.js';

describe('Admin Portal Endpoints & Authentication (Integration)', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  const adminKey = env.ADMIN_API_KEY;

  it('fails administrative login with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({
        email: 'ops@reignovatechnologies.com',
        password: 'incorrect_admin_password',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
  });

  it('authenticates admin login and returns valid signed JWT', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({
        email: 'ops@reignovatechnologies.com',
        password: adminKey,
        role: 'SUPER_ADMIN',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('ops@reignovatechnologies.com');
    expect(res.body.data.user.role).toBe('SUPER_ADMIN');
  });

  it('allows access to protected /admin/auth/me using Bearer JWT', async () => {
    const loginRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({
        email: 'ops@reignovatechnologies.com',
        password: adminKey,
        role: 'SUPER_ADMIN',
      });

    const token = loginRes.body.data.token;

    const meRes = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.email).toBe('ops@reignovatechnologies.com');
  });

  it('computes live dashboard metrics under /admin/stats', async () => {
    // Seed an application and deposit
    const testApp = await Application.create({
      name: 'Stats Test App',
      slug: 'stats-test-app',
      apiKeyHash: 'dummy_hash',
      apiKeyPrefix: 'sk_live',
      status: ApplicationStatus.ACTIVE,
    });

    await Payment.create({
      applicationId: testApp.id,
      reference: 'DEP-STATS-001',
      type: PaymentType.DEPOSIT,
      amount: 250000,
      currency: 'TZS',
      phoneNumber: '+255754111222',
      country: 'TZA',
      status: PaymentStatus.COMPLETED,
    });

    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Admin-Api-Key', adminKey);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalVolume).toBe(250000);
    expect(res.body.data.successfulTx).toBe(1);
    expect(res.body.data.activeMerchants).toBe(1);
  });

  it('lists payments and retrieves payment details by ID', async () => {
    const testApp = await Application.create({
      name: 'Payment Test App',
      slug: 'payment-test-app',
      apiKeyHash: 'dummy_hash',
      apiKeyPrefix: 'sk_live',
      status: ApplicationStatus.ACTIVE,
    });

    const payment = await Payment.create({
      applicationId: testApp.id,
      reference: 'DEP-LIST-001',
      type: PaymentType.DEPOSIT,
      amount: 100000,
      currency: 'TZS',
      phoneNumber: '+255713444555',
      country: 'TZA',
      status: PaymentStatus.COMPLETED,
    });

    const listRes = await request(app)
      .get('/api/v1/admin/payments?status=COMPLETED')
      .set('Admin-Api-Key', adminKey);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].reference).toBe('DEP-LIST-001');

    const detailRes = await request(app)
      .get(`/api/v1/admin/payments/${payment.id}`)
      .set('Admin-Api-Key', adminKey);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.id).toBe(payment.id);
  });

  it('lists and approves refunds through administrative workflow', async () => {
    const testApp = await Application.create({
      name: 'Refund Test App',
      slug: 'refund-test-app',
      apiKeyHash: 'dummy_hash',
      apiKeyPrefix: 'sk_live',
      status: ApplicationStatus.ACTIVE,
    });

    const originalPayment = await Payment.create({
      applicationId: testApp.id,
      reference: 'DEP-ORIG-001',
      type: PaymentType.DEPOSIT,
      amount: 80000,
      currency: 'TZS',
      phoneNumber: '+255754000111',
      country: 'TZA',
      status: PaymentStatus.COMPLETED,
    });

    const refund = await Payment.create({
      applicationId: testApp.id,
      reference: 'REF-TEST-001',
      type: PaymentType.REFUND,
      originalPaymentId: originalPayment.id,
      amount: 40000,
      currency: 'TZS',
      phoneNumber: '+255754000111',
      country: 'TZA',
      status: PaymentStatus.PENDING,
    });

    const listRes = await request(app)
      .get('/api/v1/admin/refunds')
      .set('Admin-Api-Key', adminKey);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);

    const approveRes = await request(app)
      .post(`/api/v1/admin/refunds/${refund.id}/approve`)
      .set('Admin-Api-Key', adminKey);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.success).toBe(true);
    expect(approveRes.body.data.refund.status).toBe('COMPLETED');
  });

  it('lists checkout sessions and audit logs', async () => {
    const testApp = await Application.create({
      name: 'Checkout & Audit Test App',
      slug: 'checkout-audit-test-app',
      apiKeyHash: 'dummy_hash',
      apiKeyPrefix: 'sk_live',
      status: ApplicationStatus.ACTIVE,
    });

    await Checkout.create({
      applicationId: testApp.id,
      reference: 'CHK-TEST-001',
      publicToken: 'tok_chk_test_001',
      returnUrl: 'https://example.com/return',
      status: CheckoutStatus.WAITING_PAYMENT,
      customerName: 'Baraka Juma',
      amounts: [{ country: 'TZA', amount: '50000', currency: 'TZS' }],
      countries: ['TZA'],
    });

    await AuditLog.create({
      actor: 'ops@reignovatechnologies.com (SUPER_ADMIN)',
      applicationId: testApp.id,
      resourceType: 'APPLICATION',
      resourceId: testApp.id,
      action: 'APPLICATION_CREATE',
    });

    const chkRes = await request(app)
      .get('/api/v1/admin/checkout-sessions')
      .set('Admin-Api-Key', adminKey);

    expect(chkRes.status).toBe(200);
    expect(chkRes.body.data.length).toBe(1);
    expect(chkRes.body.data[0].customerName).toBe('Baraka Juma');

    const auditRes = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Admin-Api-Key', adminKey);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBe(1);
    expect(auditRes.body.data[0].action).toBe('APPLICATION_CREATE');
  });
});
