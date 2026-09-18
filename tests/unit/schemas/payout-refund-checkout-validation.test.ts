import { describe, it, expect } from 'vitest';
import { createPayoutSchema } from '../../../src/schemas/payout.schema.js';
import { createRefundSchema } from '../../../src/schemas/refund.schema.js';
import { createCheckoutSchema } from '../../../src/schemas/checkout.schema.js';

describe('Payout, Refund & Checkout Schema Validation', () => {
  describe('createPayoutSchema', () => {
    const validPayout = {
      reference: 'PAYOUT-001',
      amount: 15000,
      currency: 'TZS',
      phoneNumber: '+255754123456',
      country: 'TZ',
      customerMessage: 'Bonus payment',
      description: 'Quarterly bonus'
    };

    it('validates a valid payout payload', () => {
      const parsed = createPayoutSchema.parse(validPayout);
      expect(parsed.reference).toBe('PAYOUT-001');
      expect(parsed.currency).toBe('TZS');
      expect(parsed.country).toBe('TZ');
    });

    it('rejects invalid E.164 phone numbers', () => {
      expect(() =>
        createPayoutSchema.parse({ ...validPayout, phoneNumber: '0754123456' })
      ).toThrow();
      expect(() =>
        createPayoutSchema.parse({ ...validPayout, phoneNumber: 'invalid-phone' })
      ).toThrow();
    });

    it('rejects customerMessage longer than 22 characters', () => {
      expect(() =>
        createPayoutSchema.parse({
          ...validPayout,
          customerMessage: 'This customer message is way too long'
        })
      ).toThrow();
    });

    it('rejects negative or zero amounts', () => {
      expect(() => createPayoutSchema.parse({ ...validPayout, amount: -500 })).toThrow();
      expect(() => createPayoutSchema.parse({ ...validPayout, amount: 0 })).toThrow();
    });
  });

  describe('createRefundSchema', () => {
    const validRefund = {
      depositPaymentId: 'e123b810-9dad-11d1-80b4-00c04fd430c8',
      reference: 'REFUND-001',
      amount: 5000,
      currency: 'TZS',
      description: 'Customer return'
    };

    it('validates a valid refund payload', () => {
      const parsed = createRefundSchema.parse(validRefund);
      expect(parsed.depositPaymentId).toBe(validRefund.depositPaymentId);
      expect(parsed.reference).toBe('REFUND-001');
    });

    it('allows omitting optional amount and currency for full refund', () => {
      const parsed = createRefundSchema.parse({
        depositPaymentId: 'e123b810-9dad-11d1-80b4-00c04fd430c8',
        reference: 'REFUND-FULL'
      });
      expect(parsed.amount).toBeUndefined();
      expect(parsed.currency).toBeUndefined();
    });

    it('rejects invalid UUID for depositPaymentId', () => {
      expect(() =>
        createRefundSchema.parse({ ...validRefund, depositPaymentId: 'not-a-uuid' })
      ).toThrow();
    });

    it('rejects negative refund amounts', () => {
      expect(() =>
        createRefundSchema.parse({ ...validRefund, amount: -100 })
      ).toThrow();
    });
  });

  describe('createCheckoutSchema', () => {
    const validCheckout = {
      reference: 'CHECKOUT-001',
      returnUrl: 'https://myshop.com/return',
      returnMethod: 'POST' as const,
      defaultLanguage: 'en',
      countries: ['TZ', 'ZM'],
      amounts: [{ country: 'TZ', currency: 'TZS', amount: 25000 }],
      expiresAfter: 15
    };

    it('validates a valid checkout payload', () => {
      const parsed = createCheckoutSchema.parse(validCheckout);
      expect(parsed.returnUrl).toBe('https://myshop.com/return');
      expect(parsed.expiresAfter).toBe(15);
    });

    it('rejects invalid returnUrl', () => {
      expect(() =>
        createCheckoutSchema.parse({ ...validCheckout, returnUrl: 'not-a-url' })
      ).toThrow();
    });

    it('rejects expiresAfter outside 3-60 minutes', () => {
      expect(() =>
        createCheckoutSchema.parse({ ...validCheckout, expiresAfter: 1 })
      ).toThrow();
      expect(() =>
        createCheckoutSchema.parse({ ...validCheckout, expiresAfter: 120 })
      ).toThrow();
    });
  });
});
