import { describe, it, expect } from 'vitest';
import { PawapayMapper } from '../../../src/integrations/pawapay/pawapay.mapper.js';
import { PaymentStatus } from '../../../src/models/payment.model.js';
import { ValidationError } from '../../../src/utils/errors.js';

describe('PawapayMapper', () => {
  describe('Country Code Mapping (Tanzania Only)', () => {
    it('accepts TZ and TZA and maps to TZA', () => {
      expect(PawapayMapper.toAlpha3Country('TZ')).toBe('TZA');
      expect(PawapayMapper.toAlpha3Country('TZA')).toBe('TZA');
    });

    it('throws ValidationError for countries other than Tanzania', () => {
      expect(() => PawapayMapper.toAlpha3Country('KE')).toThrow(ValidationError);
      expect(() => PawapayMapper.toAlpha3Country('ZM')).toThrow(ValidationError);
      expect(() => PawapayMapper.toAlpha3Country('UG')).toThrow(ValidationError);
      expect(() => PawapayMapper.toAlpha3Country('XX')).toThrow(ValidationError);
    });
  });

  describe('Provider Normalization (Vodacom, Airtel, Yas/Tigo)', () => {
    it('normalizes Vodacom variants to VODACOM_TZA', () => {
      expect(PawapayMapper.normalizeProvider('VODACOM_TZA')).toBe('VODACOM_TZA');
      expect(PawapayMapper.normalizeProvider('VODACOM')).toBe('VODACOM_TZA');
      expect(PawapayMapper.normalizeProvider('MPESA')).toBe('VODACOM_TZA');
    });

    it('normalizes Airtel variants to AIRTEL_TZA', () => {
      expect(PawapayMapper.normalizeProvider('AIRTEL_TZA')).toBe('AIRTEL_TZA');
      expect(PawapayMapper.normalizeProvider('AIRTEL')).toBe('AIRTEL_TZA');
    });

    it('normalizes Yas / Tigo variants to TIGO_TZA', () => {
      expect(PawapayMapper.normalizeProvider('YAS_TZA')).toBe('TIGO_TZA');
      expect(PawapayMapper.normalizeProvider('YAS')).toBe('TIGO_TZA');
      expect(PawapayMapper.normalizeProvider('TIGO_TZA')).toBe('TIGO_TZA');
      expect(PawapayMapper.normalizeProvider('TIGO')).toBe('TIGO_TZA');
    });

    it('throws ValidationError on unsupported providers', () => {
      expect(() => PawapayMapper.normalizeProvider('MTN_MOMO_ZMB')).toThrow(ValidationError);
      expect(() => PawapayMapper.normalizeProvider('HALOTEL_TZA')).toThrow(ValidationError);
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
        provider: 'VODACOM_TZA',
        description: 'Concert Ticket #123',
        metadata: { ticketId: 'TCK-1' }
      };

      const result = PawapayMapper.toPawapayDepositRequest(internalReq, 'VODACOM_TZA');

      expect(result.depositId).toBe(internalReq.paymentId);
      expect(result.amount).toBe('25001'); // TZS is zero-decimal
      expect(result.currency).toBe('TZS');
      expect(result.country).toBeUndefined();
      expect(result.payer.type).toBe('MMO');
      expect(result.payer.accountDetails.phoneNumber).toBe('255700000000');
      expect(result.payer.accountDetails.provider).toBe('VODACOM_TZA');
      expect(result.clientReferenceId).toBe('REF-001');
      expect(result.customerMessage).toBe('Concert Ticket 123'); // Special char sanitized
      expect(result.metadata).toEqual([{ ticketId: 'TCK-1' }]);

      // Verify Yas (Tigo) normalizes to TIGO_TZA
      const yasResult = PawapayMapper.toPawapayDepositRequest(
        { ...internalReq, provider: 'YAS_TZA' },
        'YAS_TZA'
      );
      expect(yasResult.payer.accountDetails.provider).toBe('TIGO_TZA');
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
