import { describe, it, expect } from 'vitest';
import { PaymentStatus, isValidTransition, ALLOWED_STATE_TRANSITIONS } from '../../../src/types/payment.types.js';

describe('Payment State Machine', () => {
  describe('Valid State Transitions', () => {
    it('allows transition from PENDING to PROCESSING', () => {
      expect(isValidTransition(PaymentStatus.PENDING, PaymentStatus.PROCESSING)).toBe(true);
    });

    it('allows transition from PENDING to FAILED', () => {
      expect(isValidTransition(PaymentStatus.PENDING, PaymentStatus.FAILED)).toBe(true);
    });

    it('allows transition from PENDING to CANCELLED', () => {
      expect(isValidTransition(PaymentStatus.PENDING, PaymentStatus.CANCELLED)).toBe(true);
    });

    it('allows transition from PENDING to EXPIRED', () => {
      expect(isValidTransition(PaymentStatus.PENDING, PaymentStatus.EXPIRED)).toBe(true);
    });

    it('allows transition from PROCESSING to COMPLETED', () => {
      expect(isValidTransition(PaymentStatus.PROCESSING, PaymentStatus.COMPLETED)).toBe(true);
    });

    it('allows transition from PROCESSING to FAILED', () => {
      expect(isValidTransition(PaymentStatus.PROCESSING, PaymentStatus.FAILED)).toBe(true);
    });

    it('allows transition from PROCESSING to EXPIRED', () => {
      expect(isValidTransition(PaymentStatus.PROCESSING, PaymentStatus.EXPIRED)).toBe(true);
    });

    it('allows same-state transitions as idempotent no-ops', () => {
      expect(isValidTransition(PaymentStatus.PENDING, PaymentStatus.PENDING)).toBe(true);
      expect(isValidTransition(PaymentStatus.PROCESSING, PaymentStatus.PROCESSING)).toBe(true);
      expect(isValidTransition(PaymentStatus.COMPLETED, PaymentStatus.COMPLETED)).toBe(true);
      expect(isValidTransition(PaymentStatus.FAILED, PaymentStatus.FAILED)).toBe(true);
    });
  });

  describe('Invalid State Transitions (Terminal States & Illegal Skips)', () => {
    it('disallows PENDING directly to COMPLETED without PROCESSING', () => {
      expect(isValidTransition(PaymentStatus.PENDING, PaymentStatus.COMPLETED)).toBe(false);
    });

    it('disallows transitions out of COMPLETED (terminal)', () => {
      expect(isValidTransition(PaymentStatus.COMPLETED, PaymentStatus.PENDING)).toBe(false);
      expect(isValidTransition(PaymentStatus.COMPLETED, PaymentStatus.PROCESSING)).toBe(false);
      expect(isValidTransition(PaymentStatus.COMPLETED, PaymentStatus.FAILED)).toBe(false);
      expect(isValidTransition(PaymentStatus.COMPLETED, PaymentStatus.CANCELLED)).toBe(false);
      expect(isValidTransition(PaymentStatus.COMPLETED, PaymentStatus.EXPIRED)).toBe(false);
    });

    it('disallows transitions out of FAILED (terminal)', () => {
      expect(isValidTransition(PaymentStatus.FAILED, PaymentStatus.PENDING)).toBe(false);
      expect(isValidTransition(PaymentStatus.FAILED, PaymentStatus.PROCESSING)).toBe(false);
      expect(isValidTransition(PaymentStatus.FAILED, PaymentStatus.COMPLETED)).toBe(false);
      expect(isValidTransition(PaymentStatus.FAILED, PaymentStatus.CANCELLED)).toBe(false);
    });

    it('disallows transitions out of CANCELLED (terminal)', () => {
      expect(isValidTransition(PaymentStatus.CANCELLED, PaymentStatus.COMPLETED)).toBe(false);
      expect(isValidTransition(PaymentStatus.CANCELLED, PaymentStatus.PROCESSING)).toBe(false);
    });

    it('disallows transitions out of EXPIRED (terminal)', () => {
      expect(isValidTransition(PaymentStatus.EXPIRED, PaymentStatus.COMPLETED)).toBe(false);
      expect(isValidTransition(PaymentStatus.EXPIRED, PaymentStatus.PROCESSING)).toBe(false);
    });

    it('verifies terminal states have empty transition lists', () => {
      expect(ALLOWED_STATE_TRANSITIONS[PaymentStatus.COMPLETED]).toEqual([]);
      expect(ALLOWED_STATE_TRANSITIONS[PaymentStatus.FAILED]).toEqual([]);
      expect(ALLOWED_STATE_TRANSITIONS[PaymentStatus.CANCELLED]).toEqual([]);
      expect(ALLOWED_STATE_TRANSITIONS[PaymentStatus.EXPIRED]).toEqual([]);
    });
  });
});
