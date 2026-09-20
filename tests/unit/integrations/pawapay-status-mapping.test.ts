import { describe, it, expect } from 'vitest';
import { PawapayMapper } from '../../../src/integrations/pawapay/pawapay.mapper.js';
import { CheckoutStatus } from '../../../src/models/checkout.model.js';

describe('pawaPay Status Mapping', () => {
  describe('toCheckoutStatus', () => {
    it('maps ACCEPTED to WAITING_PAYMENT per pawaPay v2 initiation spec', () => {
      expect(PawapayMapper.toCheckoutStatus('ACCEPTED')).toBe(CheckoutStatus.WAITING_PAYMENT);
    });

    it('maps REJECTED to FAILED per pawaPay v2 initiation spec', () => {
      expect(PawapayMapper.toCheckoutStatus('REJECTED')).toBe(CheckoutStatus.FAILED);
    });

    it('maps DUPLICATE_IGNORED to FAILED per pawaPay v2 spec', () => {
      expect(PawapayMapper.toCheckoutStatus('DUPLICATE_IGNORED')).toBe(CheckoutStatus.FAILED);
    });

    it('maps WAITING_PAYMENT directly to WAITING_PAYMENT', () => {
      expect(PawapayMapper.toCheckoutStatus('WAITING_PAYMENT')).toBe(CheckoutStatus.WAITING_PAYMENT);
    });

    it('maps PROCESSING directly to PROCESSING', () => {
      expect(PawapayMapper.toCheckoutStatus('PROCESSING')).toBe(CheckoutStatus.PROCESSING);
    });

    it('maps COMPLETED directly to COMPLETED', () => {
      expect(PawapayMapper.toCheckoutStatus('COMPLETED')).toBe(CheckoutStatus.COMPLETED);
    });

    it('maps EXPIRED directly to EXPIRED', () => {
      expect(PawapayMapper.toCheckoutStatus('EXPIRED')).toBe(CheckoutStatus.EXPIRED);
    });

    it('maps CANCELLED directly to CANCELLED', () => {
      expect(PawapayMapper.toCheckoutStatus('CANCELLED')).toBe(CheckoutStatus.CANCELLED);
    });

    it('maps unknown statuses to FAILED for safety', () => {
      expect(PawapayMapper.toCheckoutStatus('UNKNOWN_STATUS' as any)).toBe(CheckoutStatus.FAILED);
    });
  });

  describe('toProviderCheckoutRequest', () => {
    it('sets returnMethod to INSTANT by default per pawaPay v2 spec', () => {
      const checkoutReq = PawapayMapper.toProviderCheckoutRequest({
        id: 'chk_123',
        amount: 5000,
        currency: 'TZS',
        description: 'Test Order',
        customerEmail: 'test@example.com',
        customerName: 'Jane Doe',
        redirectUrl: 'https://example.com/return'
      });

      expect(checkoutReq.returnMethod).toBe('INSTANT');
      expect(checkoutReq.returnUrl).toBe('https://example.com/return');
      expect(checkoutReq.checkoutId).toBe('chk_123');
    });

    it('respects explicitly provided returnMethod', () => {
      const checkoutReq = PawapayMapper.toProviderCheckoutRequest(
        {
          id: 'chk_456',
          amount: 10000,
          currency: 'ZMW',
          description: 'Custom returnMethod Test'
        },
        'COUNTDOWN'
      );

      expect(checkoutReq.returnMethod).toBe('COUNTDOWN');
    });
  });
});
