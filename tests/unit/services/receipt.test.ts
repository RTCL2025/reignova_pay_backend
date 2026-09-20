import { describe, it, expect } from 'vitest';
import { receiptService } from '../../../src/services/receipt.service.js';
import { Checkout, CheckoutStatus } from '../../../src/models/checkout.model.js';
import { Payment, PaymentStatus } from '../../../src/models/payment.model.js';

describe('ReceiptService (Unit)', () => {
  const dummyCheckout = {
    id: 'chk-12345',
    applicationId: 'app-999',
    reference: 'EVT-TICKET-REV-2026-000007',
    publicToken: 'cs_sec_1234567890',
    returnUrl: 'https://events.reignova.com/callback',
    status: CheckoutStatus.COMPLETED,
    customerName: 'Amani Mtema',
    customerEmail: 'amani@example.com',
    customerPhone: '+255754123456',
    amounts: [{ country: 'TZA', currency: 'TZS', amount: 150000 }],
    depositId: 'DEP-991823',
    createdAt: new Date('2026-09-19T10:00:00Z'),
    completedAt: new Date('2026-09-19T10:05:00Z'),
    metadata: {
      itemTitle: 'Dar Tech Summit 2026',
      itemSubtitle: 'VIP Full-Access + Workshop Tracks',
      itemCategory: 'Annual Flagship Pass',
      subtotal: 135000,
      fee: 15000,
      quantity: 1,
      itemName: 'Pass Access'
    },
    application: {
      name: 'Reignova Events',
      slug: 'reignova-events'
    }
  } as unknown as Checkout;

  const dummyPayment = {
    id: 'pay-77777',
    applicationId: 'app-999',
    reference: 'PAY-REF-998877',
    type: 'DEPOSIT',
    amount: 250000,
    currency: 'TZS',
    phoneNumber: '+255784000111',
    provider: 'VODACOM_TZA',
    providerPaymentId: 'PAWA-DEP-8899',
    status: PaymentStatus.COMPLETED,
    description: 'Ticket Order #998877',
    createdAt: new Date('2026-09-19T12:00:00Z'),
    completedAt: new Date('2026-09-19T12:02:00Z'),
    metadata: {
      itemTitle: 'Executive VIP Pass',
      subtotal: 230000,
      fee: 20000,
      customerName: 'Kiprotich M',
      customerEmail: 'kip@example.com'
    },
    application: {
      name: 'Reignova Events',
      slug: 'reignova-events'
    }
  } as unknown as Payment;

  it('generates a valid binary PDF buffer for a Checkout session with PDF header magic bytes', async () => {
    const pdfBuffer = await receiptService.generateReceiptPdf(dummyCheckout);

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(500);
    // PDF magic bytes header: %PDF-
    expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('generates a valid binary PDF buffer for a Payment record with PDF header magic bytes', async () => {
    const pdfBuffer = await receiptService.generatePaymentReceiptPdf(dummyPayment);

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(500);
    expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('generates a valid, complete HTML receipt document', () => {
    const html = receiptService.generateReceiptHtml(dummyCheckout);

    expect(html).toContain('Payment Receipt - EVT-TICKET-REV-2026-000007');
    expect(html).toContain('REIGNOVA');
    expect(html).toContain('TZS 150,000');
    expect(html).toContain('Reignova Events');
    expect(html).toContain('Dar Tech Summit 2026');
    expect(html).toContain('Amani Mtema');
    expect(html).toContain('amani@example.com');
    expect(html).toContain('+255754123456');
    expect(html).toContain('TZS 135,000');
    expect(html).toContain('TZS 15,000');
    expect(html).toContain('DEP-991823');
  });

  it('skips sending email gracefully if recipient email is missing', async () => {
    const checkoutWithoutEmail = {
      ...dummyCheckout,
      customerEmail: null,
      payer: null
    } as unknown as Checkout;

    const result = await receiptService.sendReceiptEmail(checkoutWithoutEmail);
    expect(result).toBe(false);
  });

  it('skips sending email gracefully if RESEND_API_KEY is not configured', async () => {
    const result = await receiptService.sendReceiptEmail(dummyCheckout);
    // Since RESEND_API_KEY is not set in unit test env, it returns false gracefully
    expect(result).toBe(false);
  });
});

