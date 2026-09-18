import { describe, it, expect } from 'vitest';
import { createPaymentSchema } from '../../../src/schemas/payment.schema.js';

describe('Payment Validation Schema (Zod)', () => {
  const validPayment = {
    reference: 'ORDER-12345',
    amount: 50000,
    currency: 'TZS',
    phoneNumber: '+255754123456',
    country: 'TZ',
    provider: 'VODACOM_TZA',
    description: 'Ticket purchase',
    metadata: { orderId: 'ord-1' }
  };

  it('validates a correct payment payload successfully', () => {
    const result = createPaymentSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('TZS');
      expect(result.data.country).toBe('TZ');
      expect(result.data.provider).toBe('VODACOM_TZA');
    }
  });

  it('accepts valid Tanzania providers (Vodacom, Airtel, Yas/Tigo)', () => {
    expect(createPaymentSchema.safeParse({ ...validPayment, provider: 'AIRTEL_TZA' }).success).toBe(true);
    expect(createPaymentSchema.safeParse({ ...validPayment, provider: 'YAS_TZA' }).success).toBe(true);
    expect(createPaymentSchema.safeParse({ ...validPayment, provider: 'TIGO_TZA' }).success).toBe(true);
    expect(createPaymentSchema.safeParse({ ...validPayment, provider: 'VODACOM' }).success).toBe(true);
    expect(createPaymentSchema.safeParse({ ...validPayment, provider: 'YAS' }).success).toBe(true);
  });

  it('rejects unsupported providers', () => {
    expect(createPaymentSchema.safeParse({ ...validPayment, provider: 'MTN_MOMO_ZMB' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...validPayment, provider: 'HALOTEL_TZA' }).success).toBe(false);
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

  it('rejects non-integer amounts for TZS', () => {
    expect(createPaymentSchema.safeParse({ ...validPayment, amount: 50.123 }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...validPayment, amount: 50.5 }).success).toBe(false);
  });

  it('rejects non-TZS currencies', () => {
    expect(createPaymentSchema.safeParse({ ...validPayment, currency: 'USD' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...validPayment, currency: 'KES' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...validPayment, currency: 'ZMW' }).success).toBe(false);
  });

  it('rejects non-Tanzania phone numbers or invalid format', () => {
    expect(createPaymentSchema.safeParse({ ...validPayment, phoneNumber: '0700000000' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...validPayment, phoneNumber: '+254700000000' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...validPayment, phoneNumber: '+123' }).success).toBe(false);
  });

  it('rejects non-Tanzania country codes', () => {
    expect(createPaymentSchema.safeParse({ ...validPayment, country: 'KE' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...validPayment, country: 'ZM' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...validPayment, country: 'TZA' }).success).toBe(false);
  });
});
