import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { clearDatabase } from '../helpers/setup.js';
import { sequelize } from '../../src/config/database.js';

describe('Application Management & Admin Authentication (Integration)', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  const adminKey = env.ADMIN_API_KEY;

  it('rejects unauthenticated requests to admin endpoints', async () => {
    const res = await request(app).post('/api/v1/admin/applications').send({
      name: 'Test App',
      slug: 'test-app'
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
  });

  it('rejects invalid admin API key', async () => {
    const res = await request(app)
      .post('/api/v1/admin/applications')
      .set('Admin-Api-Key', 'wrong-admin-key')
      .send({
        name: 'Test App',
        slug: 'test-app'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('creates an application and returns generated API key', async () => {
    const res = await request(app)
      .post('/api/v1/admin/applications')
      .set('Admin-Api-Key', adminKey)
      .send({
        name: 'Ticket Master SaaS',
        slug: 'ticket-master',
        description: 'Ticketing service',
        webhookUrl: 'https://example.com/webhooks'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.application.name).toBe('Ticket Master SaaS');
    expect(res.body.data.application.slug).toBe('ticket-master');
    expect(res.body.data.apiKey).toMatch(/^pk_live_[0-9a-f]{64}$/);
    expect(res.body.data.webhookSecret).toMatch(/^whsec_[0-9a-f]{64}$/);
  });

  it('prevents creating application with duplicate slug', async () => {
    await request(app)
      .post('/api/v1/admin/applications')
      .set('Admin-Api-Key', adminKey)
      .send({
        name: 'App 1',
        slug: 'shared-slug'
      });

    const duplicateRes = await request(app)
      .post('/api/v1/admin/applications')
      .set('Admin-Api-Key', adminKey)
      .send({
        name: 'App 2',
        slug: 'shared-slug'
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error.code).toBe('CONFLICT');
  });

  it('rotates API key for an existing application', async () => {
    const createRes = await request(app)
      .post('/api/v1/admin/applications')
      .set('Admin-Api-Key', adminKey)
      .send({
        name: 'Rotate Test App',
        slug: 'rotate-app'
      });

    const appId = createRes.body.data.application.id;
    const oldKey = createRes.body.data.apiKey;

    const rotateRes = await request(app)
      .post(`/api/v1/admin/applications/${appId}/rotate-key`)
      .set('Admin-Api-Key', adminKey);

    expect(rotateRes.status).toBe(200);
    expect(rotateRes.body.success).toBe(true);
    const newKey = rotateRes.body.data.apiKey;
    expect(newKey).not.toBe(oldKey);
    expect(newKey).toMatch(/^pk_live_/);
  });

  it('suspends and reactivates an application', async () => {
    const createRes = await request(app)
      .post('/api/v1/admin/applications')
      .set('Admin-Api-Key', adminKey)
      .send({
        name: 'Status Test App',
        slug: 'status-app'
      });

    const appId = createRes.body.data.application.id;

    // Suspend
    const suspendRes = await request(app)
      .post(`/api/v1/admin/applications/${appId}/suspend`)
      .set('Admin-Api-Key', adminKey);
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.status).toBe('SUSPENDED');

    // Reactivate
    const reactivateRes = await request(app)
      .post(`/api/v1/admin/applications/${appId}/reactivate`)
      .set('Admin-Api-Key', adminKey);
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.status).toBe('ACTIVE');
  });
});
