import { describe, it, expect } from 'vitest';
import {
  PawapayMapper,
  formatCurrencyAmount
} from '../../../src/integrations/pawapay/pawapay.mapper.js';
import { CheckoutStatus } from '../../../src/models/checkout.model.js';
import { PaymentStatus } from '../../../src/models/payment.model.js';

describe('Pawapay Payout, Refund & Checkout Mapper', () => {
  describe('formatCurrencyAmount', () => {
    it('formats zero-decimal currencies as integers', () => {
      expect(formatCurrencyAmount(15000.75, 'TZS')).toBe('15001');
      expect(formatCurrencyAmount(5000, 'UGX')).toBe('5000');
      expect(formatCurrencyAmount(2500.4, 'RWF')).toBe('2500');
      expect(formatCurrencyAmount(1000, 'XAF')).toBe('1000');
    });

    it('formats decimal currencies with 2 decimal places', () => {
      expect(formatCurrencyAmount(15.5, 'USD')).toBe('15.50');
      expect(formatCurrencyAmount(100, 'EUR')).toBe('100.00');
      expect(formatCurrencyAmount(50.256, 'KES')).toBe('50.26');
    });
  });

  describe('normalizeCountry', () => {
    it('maps 2-letter ISO codes to 3-letter codes', () => {
      expect(PawapayMapper.normalizeCountry('TZ')).toBe('TZA');
      expect(PawapayMapper.normalizeCountry('ZM')).toBe('ZMB');
      expect(PawapayMapper.normalizeCountry('UG')).toBe('UGA');
      expect(PawapayMapper.normalizeCountry('GH')).toBe('GHA');
      expect(PawapayMapper.normalizeCountry('KE')).toBe('KEN');
    });

    it('preserves 3-letter ISO codes', () => {
      expect(PawapayMapper.normalizeCountry('TZA')).toBe('TZA');
      expect(PawapayMapper.normalizeCountry('ZMB')).toBe('ZMB');
    });
  });

  describe('sanitizeCustomerMessage', () => {
    it('sanitizes and pads customerMessage to meet 4-22 chars requirement', () => {
      expect(PawapayMapper.sanitizeCustomerMessage('Hi')).toBe('Hi Payout');
      expect(PawapayMapper.sanitizeCustomerMessage('Salary Payment for March')).toBe('Salary Payment for Mar');
      expect(PawapayMapper.sanitizeCustomerMessage('Order #123!@#')).toBe('Order 123');
    });
  });

  describe('toPawapayPayoutRequest', () => {
    it('creates complete PawapayPayoutRequest with recipient details', () => {
      const internalPayout = {
        paymentId: 'b567b810-9dad-11d1-80b4-00c04fd430c8',
        reference: 'PAYOUT-001',
        amount: 30000,
        currency: 'TZS',
        phoneNumber: '+255754123456',
        country: 'TZ',
        customerMessage: 'Bonus Payment',
        description: 'Monthly performance bonus',
        metadata: { employeeId: 'EMP-42' }
      };

      const result = PawapayMapper.toPawapayPayoutRequest(internalPayout, 'VODACOM_TZA');

      expect(result.payoutId).toBe(internalPayout.paymentId);
      expect(result.amount).toBe('30000');
      expect(result.currency).toBe('TZS');
      expect(result.recipient.type).toBe('MMO');
      expect(result.recipient.accountDetails.phoneNumber).toBe('255754123456');
      expect(result.recipient.accountDetails.provider).toBe('VODACOM_TZA');
      expect(result.customerMessage).toBe('Bonus Payment');
      expect(result.clientReferenceId).toBe('PAYOUT-001');
      expect(result.metadata).toEqual([{ employeeId: 'EMP-42' }]);
    });
  });

  describe('toPawapayRefundRequest', () => {
    it('creates PawapayRefundRequest for full and partial refund', () => {
      const fullRefund = {
        refundId: 'c123b810-9dad-11d1-80b4-00c04fd430c8',
        depositId: 'd456b810-9dad-11d1-80b4-00c04fd430c8'
      };

      const fullResult = PawapayMapper.toPawapayRefundRequest(fullRefund);
      expect(fullResult.refundId).toBe(fullRefund.refundId);
      expect(fullResult.depositId).toBe(fullRefund.depositId);
      expect(fullResult.amount).toBeUndefined();

      const partialRefund = {
        refundId: 'c123b810-9dad-11d1-80b4-00c04fd430c8',
        depositId: 'd456b810-9dad-11d1-80b4-00c04fd430c8',
        amount: 12500,
        currency: 'TZS'
      };

      const partialResult = PawapayMapper.toPawapayRefundRequest(partialRefund);
      expect(partialResult.amount).toBe('12500');
      expect(partialResult.currency).toBe('TZS');
    });
  });

  describe('toPawapayCheckoutRequest', () => {
    it('creates complete PawapayCheckoutRequest', () => {
      const checkoutReq = {
        checkoutId: 'e789b810-9dad-11d1-80b4-00c04fd430c8',
        reference: 'CHK-REF-100',
        returnUrl: 'https://myshop.com/orders/100',
        returnMethod: 'POST',
        defaultLanguage: 'en',
        countries: ['TZ', 'ZM'],
        amounts: [
          { country: 'TZ', currency: 'TZS', amount: 50000 },
          { country: 'ZM', currency: 'ZMW', amount: 500.5 }
        ],
        payer: {
          phoneNumber: '255754123456',
          allowCustomerToOverride: true
        },
        reason: { orderNumber: '100' },
        expiresAfter: 30
      };

      const result = PawapayMapper.toPawapayCheckoutRequest(checkoutReq);

      expect(result.checkoutId).toBe(checkoutReq.checkoutId);
      expect(result.returnUrl).toBe('https://myshop.com/orders/100');
      // POST is legacy/invalid in Pawapay V2, so mapper normalizes to INSTANT
      expect(result.returnMethod).toBe('INSTANT');
      expect(result.defaultLanguage).toBe('en');
      expect(result.countries).toEqual(['TZA', 'ZMB']);
      expect(result.amounts).toEqual([
        { country: 'TZA', currency: 'TZS', amount: '50000' },
        { country: 'ZMB', currency: 'ZMW', amount: '500.50' }
      ]);
      expect(result.payer?.type).toBe('MMO');
      expect(result.payer?.accountDetails.phoneNumber).toBe('255754123456');
      expect(result.payer?.accountDetails.allowCustomerToOverride).toBe(true);
      expect(result.reason?.en).toBeDefined();
      expect(result.expiresAfter).toBe(30);
      expect(result.clientReferenceId).toBe('CHK-REF-100');
    });

    it('preserves valid returnMethod and auto-populates countries from amounts if omitted', () => {
      const checkoutReq = {
        checkoutId: 'e789b810-9dad-11d1-80b4-00c04fd430c8',
        reference: 'CHK-REF-101',
        returnUrl: 'https://myshop.com/orders/101',
        returnMethod: 'COUNTDOWN',
        defaultLanguage: 'en',
        amounts: [
          { country: 'TZ', currency: 'TZS', amount: 50000 }
        ],
        reason: { en: 'Order payment' }
      };

      const result = PawapayMapper.toPawapayCheckoutRequest(checkoutReq);
      expect(result.returnMethod).toBe('COUNTDOWN');
      expect(result.countries).toEqual(['TZA']);
      expect(result.reason).toEqual({ en: 'Order payment' });
      expect(result.payer).toBeUndefined();
    });
  });

  describe('toCheckoutStatus', () => {
    it('maps Pawapay checkout statuses to CheckoutStatus enum', () => {
      expect(PawapayMapper.toCheckoutStatus('WAITING_PAYMENT')).toBe(CheckoutStatus.WAITING_PAYMENT);
      expect(PawapayMapper.toCheckoutStatus('ACCEPTED')).toBe(CheckoutStatus.WAITING_PAYMENT);
      expect(PawapayMapper.toCheckoutStatus('PROCESSING')).toBe(CheckoutStatus.PROCESSING);
      expect(PawapayMapper.toCheckoutStatus('COMPLETED')).toBe(CheckoutStatus.COMPLETED);
      expect(PawapayMapper.toCheckoutStatus('FAILED')).toBe(CheckoutStatus.FAILED);
      expect(PawapayMapper.toCheckoutStatus('EXPIRED')).toBe(CheckoutStatus.EXPIRED);
      expect(PawapayMapper.toCheckoutStatus('CANCELLED')).toBe(CheckoutStatus.CANCELLED);
    });
  });
});
