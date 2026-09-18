import { Application, ApplicationStatus } from '../models/application.model.js';
import { Payment, PaymentType, PaymentStatus } from '../models/payment.model.js';
import { Checkout, CheckoutStatus } from '../models/checkout.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { generateApiKey, generateWebhookSecret, hashApiKey } from '../utils/crypto.js';
import { sequelize } from '../config/database.js';
import { logger } from '../config/logger.js';

export async function seedDatabase(): Promise<void> {
  await sequelize.authenticate();

  logger.info('Starting database seeding...');

  // 1. Seed Applications
  const appsData = [
    {
      name: 'ReignovaEvents',
      slug: 'reignova-events',
      description: 'Event ticketing and live registration SaaS platform',
      webhookUrl: 'https://events.example.com/api/webhooks/payments',
    },
    {
      name: 'Kilimanjaro Safaris',
      slug: 'kilimanjaro-safaris',
      description: 'Adventure travel, lodge reservations and mountain expedition bookings',
      webhookUrl: 'https://kilimanjarosafaris.com/api/payments/webhook',
    },
    {
      name: 'Zanzibar Express Ferries',
      slug: 'zanzibar-ferries',
      description: 'Dar es Salaam to Stone Town high-speed sea transit booking',
      webhookUrl: 'https://zanzibarferries.co.tz/webhooks/momo',
    },
    {
      name: 'Dar Logistics Express',
      slug: 'dar-logistics',
      description: 'Inter-city freight and last-mile commercial delivery logistics',
      webhookUrl: 'https://darlogistics.co.tz/api/v1/payment-callback',
    },
  ];

  const createdApps: Record<string, Application> = {};

  for (const appItem of appsData) {
    let app = await Application.findOne({ where: { slug: appItem.slug } });
    if (!app) {
      const { apiKey, prefix } = generateApiKey(false);
      const apiKeyHash = hashApiKey(apiKey);
      const webhookSecret = generateWebhookSecret();

      app = await Application.create({
        name: appItem.name,
        slug: appItem.slug,
        description: appItem.description,
        apiKeyHash,
        apiKeyPrefix: prefix,
        status: ApplicationStatus.ACTIVE,
        webhookUrl: appItem.webhookUrl,
        webhookSecret,
      });
      logger.info({ slug: app.slug, id: app.id }, 'Created application');
    }
    createdApps[appItem.slug] = app;
  }

  const primaryApp = createdApps['reignova-events'];
  const safariApp = createdApps['kilimanjaro-safaris'];
  const ferryApp = createdApps['zanzibar-ferries'];
  const logisticsApp = createdApps['dar-logistics'];

  // 2. Seed Payments (Deposits)
  const depositSamples = [
    {
      app: primaryApp,
      reference: 'DEP-TZA-001',
      amount: 150000,
      phone: '+255754123456',
      provider: 'VODACOM_TZ',
      providerId: 'PW-VOD-882193',
      status: PaymentStatus.COMPLETED,
      desc: 'VIP Summit Pass 2026',
    },
    {
      app: safariApp,
      reference: 'DEP-TZA-002',
      amount: 850000,
      phone: '+255684998877',
      provider: 'AIRTEL_TZ',
      providerId: 'PW-AIR-443912',
      status: PaymentStatus.COMPLETED,
      desc: 'Serengeti 3-Day Safari Deposit',
    },
    {
      app: ferryApp,
      reference: 'DEP-TZA-003',
      amount: 60000,
      phone: '+255713554433',
      provider: 'TIGO_TZ',
      providerId: 'PW-TIG-119834',
      status: PaymentStatus.COMPLETED,
      desc: 'Return Economy Ticket Dar-ZNZ',
    },
    {
      app: logisticsApp,
      reference: 'DEP-TZA-004',
      amount: 35000,
      phone: '+255784221100',
      provider: 'HALOTEL_TZ',
      providerId: 'PW-HAL-776211',
      status: PaymentStatus.PENDING,
      desc: 'Freight Waybill #49102',
    },
    {
      app: primaryApp,
      reference: 'DEP-TZA-005',
      amount: 45000,
      phone: '+255754987654',
      provider: 'VODACOM_TZ',
      providerId: 'PW-VOD-992384',
      status: PaymentStatus.FAILED,
      failureReason: 'Payer cancelled USSD authorization request on handset',
      desc: 'Standard General Admission Ticket',
    },
  ];

  const createdDeposits: Payment[] = [];
  for (const sample of depositSamples) {
    let payment = await Payment.findOne({
      where: { applicationId: sample.app.id, reference: sample.reference },
    });
    if (!payment) {
      payment = await Payment.create({
        applicationId: sample.app.id,
        reference: sample.reference,
        type: PaymentType.DEPOSIT,
        amount: sample.amount,
        currency: 'TZS',
        phoneNumber: sample.phone,
        country: 'TZA',
        provider: sample.provider,
        providerPaymentId: sample.providerId,
        status: sample.status,
        failureReason: sample.failureReason || null,
        description: sample.desc,
        completedAt: sample.status === PaymentStatus.COMPLETED ? new Date() : null,
        failedAt: sample.status === PaymentStatus.FAILED ? new Date() : null,
      });
      logger.info({ reference: payment.reference }, 'Created deposit payment');
    }
    createdDeposits.push(payment);
  }

  // 3. Seed Refunds
  if (createdDeposits.length > 0) {
    const originalDeposit = createdDeposits[0];
    const refundRef = 'REF-TZA-001';
    const existingRefund = await Payment.findOne({
      where: { applicationId: primaryApp.id, reference: refundRef },
    });
    if (!existingRefund) {
      await Payment.create({
        applicationId: primaryApp.id,
        reference: refundRef,
        type: PaymentType.REFUND,
        originalPaymentId: originalDeposit.id,
        amount: 75000,
        currency: 'TZS',
        phoneNumber: originalDeposit.phoneNumber,
        country: 'TZA',
        provider: originalDeposit.provider,
        status: PaymentStatus.COMPLETED,
        description: 'Customer ticket downgrade partial refund',
        metadata: {
          requestedBy: 'operations@reignova.com',
          approvedBy: 'ops@reignovatechnologies.com',
        },
        completedAt: new Date(),
      });
      logger.info({ refundRef }, 'Created refund record');
    }
  }

  // 4. Seed Payouts
  const payoutRef = 'PO-TZA-001';
  const existingPayout = await Payment.findOne({
    where: { applicationId: logisticsApp.id, reference: payoutRef },
  });
  if (!existingPayout) {
    await Payment.create({
      applicationId: logisticsApp.id,
      reference: payoutRef,
      type: PaymentType.PAYOUT,
      amount: 120000,
      currency: 'TZS',
      phoneNumber: '+255754992211',
      country: 'TZA',
      provider: 'VODACOM_TZ',
      providerPaymentId: 'PW-OUT-99120',
      status: PaymentStatus.COMPLETED,
      description: 'Fleet Driver Weekly Settlement',
      metadata: { recipientName: 'Hamisi Bakari' },
      completedAt: new Date(),
    });
    logger.info({ payoutRef }, 'Created payout payment');
  }

  // 5. Seed Checkout Sessions
  const checkoutRef = 'CHK-SESS-9001';
  const existingCheckout = await Checkout.findOne({
    where: { applicationId: primaryApp.id, reference: checkoutRef },
  });
  if (!existingCheckout) {
    await Checkout.create({
      applicationId: primaryApp.id,
      reference: checkoutRef,
      publicToken: 'tok_live_chk_demo9001',
      returnUrl: 'https://events.example.com/checkout/complete',
      status: CheckoutStatus.WAITING_PAYMENT,
      depositStatus: 'WAITING_PAYMENT',
      customerName: 'Amani Mwinyi',
      customerEmail: 'amani.mwinyi@example.com',
      customerPhone: '+255754332211',
      amounts: [{ amount: '150000', currency: 'TZS' }],
      countries: ['TZA'],
      expiresAt: new Date(Date.now() + 3600 * 1000 * 24),
    });
    logger.info({ checkoutRef }, 'Created checkout session');
  }

  // 6. Seed Audit Logs
  const logCount = await AuditLog.count();
  if (logCount === 0) {
    await AuditLog.bulkCreate([
      {
        actor: 'ops@reignovatechnologies.com (SUPER_ADMIN)',
        applicationId: primaryApp.id,
        resourceType: 'APPLICATION',
        resourceId: primaryApp.id,
        action: 'APPLICATION_CREATE',
        metadata: {
          result: 'SUCCESS',
          beforeState: null,
          afterState: { name: primaryApp.name, slug: primaryApp.slug, status: 'ACTIVE' },
        },
        ipAddress: '192.168.1.1',
      },
      {
        actor: 'ops@reignovatechnologies.com (SUPER_ADMIN)',
        applicationId: safariApp.id,
        resourceType: 'APPLICATION',
        resourceId: safariApp.id,
        action: 'KEY_ROTATED',
        metadata: {
          result: 'SUCCESS',
          beforeState: { apiKeyPrefix: 'sk_live_old' },
          afterState: { apiKeyPrefix: 'sk_live_new' },
        },
        ipAddress: '192.168.1.1',
      },
      {
        actor: 'finance@reignovatechnologies.com (FINANCE_ADMIN)',
        applicationId: primaryApp.id,
        resourceType: 'REFUND',
        resourceId: 'REF-TZA-001',
        action: 'REFUND_APPROVED',
        metadata: {
          result: 'SUCCESS',
          amount: 75000,
          currency: 'TZS',
          originalReference: 'DEP-TZA-001',
        },
        ipAddress: '10.0.4.15',
      },
    ]);
    logger.info('Created initial audit log records');
  }

  console.info('\n======================================================');
  console.info('🎉 Database Seeded Successfully with Live Demonstrative Records');
  console.info('======================================================\n');
}

// Check if file is being run directly
const isDirectExecution = process.argv[1]?.includes('seed');
if (isDirectExecution) {
  seedDatabase()
    .then(async () => {
      await sequelize.close();
    })
    .catch(async (err) => {
      console.error('Seeding failed:', err);
      await sequelize.close();
      process.exit(1);
    });
}
