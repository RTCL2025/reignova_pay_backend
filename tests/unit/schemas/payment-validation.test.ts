import { describe, it, expect } from 'vitest';
import { createPaymentSchema } from '../../../src/schemas/payment.schema.js';

describe('Payment Validation Schema (Zod)', () => {
  const validPayment = {
    reference: 'ORDER-12345',
    amount: 50000,
    currency: 'TZS',
    phoneNumber: '+255700000000',
    country: 'TZ',
    provider: 'VODACOM_MOMO_TZA',
    description: 'Ticket purchase',
    metadata: { orderId: 'ord-1' }
  };

  it('validates a correct payment payload successfully', () => {
    const result = createPaymentSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('TZS');
      expect(result.data.country).toBe('TZ');
    }
  });

  it('rejects missing required fields', () => {
    const invalid = { amount: 50000 };
    const result = createPaymentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects non-positive or zero amount', () => {
    expect(createPaymentSchema.safeParse({ ...validPayment, amount: 0 }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...validPayment, amount: -10 }).success).toBe(false);
  });

  it('rejects amount with more than 2 decimal places', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, amount: 50.123 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid currency code length', () => {
    expect(createPaymentSchema.safeParse({ ...validPayment, currency: 'US' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...validPayment, currency: 'USDX' }).success).toBe(false);
  });

  it('rejects non-E.164 phone numbers (missing + or too short)', () => {
    expect(createPaymentSchema.safeParse({ ...validPayment, phoneNumber: '0700000000' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...validPayment, phoneNumber: '+123' }).success).toBe(false);
  });

  it('rejects country code not 2 letters', () => {
    expect(createPaymentSchema.safeParse({ ...validPayment, country: 'TZA' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...validPayment, country: 'T' }).success).toBe(false);
  });
});
