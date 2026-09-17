import { describe, it, expect } from 'vitest';
import { PawapayMapper } from '../../../src/integrations/pawapay/pawapay.mapper.js';
import { PaymentStatus } from '../../../src/models/payment.model.js';
import { ValidationError } from '../../../src/utils/errors.js';

describe('PawapayMapper', () => {
  describe('Country Code Mapping', () => {
    it('maps 2-letter country codes to ISO alpha-3', () => {
      expect(PawapayMapper.toAlpha3Country('TZ')).toBe('TZA');
      expect(PawapayMapper.toAlpha3Country('ZM')).toBe('ZMB');
      expect(PawapayMapper.toAlpha3Country('RW')).toBe('RWA');
      expect(PawapayMapper.toAlpha3Country('UG')).toBe('UGA');
      expect(PawapayMapper.toAlpha3Country('KE')).toBe('KEN');
      expect(PawapayMapper.toAlpha3Country('GH')).toBe('GHA');
      expect(PawapayMapper.toAlpha3Country('NG')).toBe('NGA');
    });

    it('preserves already 3-letter country codes', () => {
      expect(PawapayMapper.toAlpha3Country('TZA')).toBe('TZA');
      expect(PawapayMapper.toAlpha3Country('ZMB')).toBe('ZMB');
    });

    it('throws ValidationError for unsupported country code', () => {
      expect(() => PawapayMapper.toAlpha3Country('XX')).toThrow(ValidationError);
    });
  });

  describe('Phone Number Normalization', () => {
    it('normalizes E.164 phone number to MSISDN format (stripping +)', () => {
      expect(PawapayMapper.toMsisdn('+255700000000')).toBe('255700000000');
      expect(PawapayMapper.toMsisdn('+260763456789')).toBe('260763456789');
    });

    it('strips non-digits if passed loosely', () => {
      expect(PawapayMapper.toMsisdn('+255 700 000 000')).toBe('255700000000');
    });

    it('throws ValidationError on invalid phone number', () => {
      expect(() => PawapayMapper.toMsisdn('123')).toThrow(ValidationError);
    });
  });

  describe('Metadata Conversion', () => {
    it('converts key-value object to Pawapay array format', () => {
      const metadata = { orderId: 'ORD-123', eventId: 'EVT-99' };
      const result = PawapayMapper.toPawapayMetadata(metadata);

      expect(result).toEqual([
        { orderId: 'ORD-123' },
        { eventId: 'EVT-99' }
      ]);
    });

    it('handles nested objects in metadata by stringifying', () => {
      const metadata = { details: { seat: 'A1' } };
      const result = PawapayMapper.toPawapayMetadata(metadata);

      expect(result).toEqual([
        { details: JSON.stringify({ seat: 'A1' }) }
      ]);
    });

    it('returns undefined if metadata is empty or undefined', () => {
      expect(PawapayMapper.toPawapayMetadata(undefined)).toBeUndefined();
      expect(PawapayMapper.toPawapayMetadata({})).toBeUndefined();
    });
  });

  describe('Deposit Request Mapping', () => {
    it('creates complete PawapayDepositRequest payload', () => {
      const internalReq = {
        paymentId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        reference: 'REF-001',
        amount: 25000.5,
        currency: 'tzs',
        phoneNumber: '+255700000000',
        country: 'tz',
        provider: 'VODACOM_MOMO_TZA',
        description: 'Concert Ticket',
        metadata: { ticketId: 'TCK-1' }
      };

      const result = PawapayMapper.toPawapayDepositRequest(internalReq, 'VODACOM_MOMO_TZA');

      expect(result.depositId).toBe(internalReq.paymentId);
      expect(result.amount).toBe('25000.50'); // String formatted number
      expect(result.currency).toBe('TZS');
      expect(result.country).toBe('TZA');
      expect(result.payer.type).toBe('MMO');
      expect(result.payer.accountDetails.phoneNumber).toBe('255700000000');
      expect(result.payer.accountDetails.provider).toBe('VODACOM_MOMO_TZA');
      expect(result.clientReferenceId).toBe('REF-001');
      expect(result.customerMessage).toBe('Concert Ticket');
      expect(result.metadata).toEqual([{ ticketId: 'TCK-1' }]);
    });
  });

  describe('Status Mapping', () => {
    it('maps Pawapay statuses to internal PaymentStatus', () => {
      expect(PawapayMapper.toPaymentStatus('ACCEPTED')).toBe(PaymentStatus.PROCESSING);
      expect(PawapayMapper.toPaymentStatus('PROCESSING')).toBe(PaymentStatus.PROCESSING);
      expect(PawapayMapper.toPaymentStatus('IN_RECONCILIATION')).toBe(PaymentStatus.PROCESSING);
      expect(PawapayMapper.toPaymentStatus('COMPLETED')).toBe(PaymentStatus.COMPLETED);
      expect(PawapayMapper.toPaymentStatus('FAILED')).toBe(PaymentStatus.FAILED);
    });
  });
});
