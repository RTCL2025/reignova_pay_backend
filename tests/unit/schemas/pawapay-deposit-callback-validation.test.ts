import { describe, it, expect } from 'vitest';
import { pawapayUnifiedCallbackSchema } from '../../../src/schemas/webhook.schema.js';

/**
 * Validation runs as route middleware, ahead of the controller and ahead of
 * signature verification. A body shape we reject therefore never reaches any of
 * the webhook logic — pawaPay simply sees a 400 and records the callback as
 * undeliverable. These lock the shape pawaPay v2 actually sends.
 *
 * The values below are taken from a real sandbox deposit
 * (a8e5501c-2618-4f8b-b317-af307ce3823b, TIGO TANZANIA, TZS 35,000).
 */
describe('pawaPay v2 deposit callback validation (Unit)', () => {
  const realDepositCallback = {
    depositId: 'a8e5501c-2618-4f8b-b317-af307ce3823b',
    status: 'COMPLETED',
    amount: '35000',
    currency: 'TZS',
    country: 'TZA',
    payer: {
      type: 'MMO',
      accountDetails: {
        phoneNumber: '255713456789',
        provider: 'TIGO_TZA'
      }
    },
    providerTransactionId: 's78b9uoTR9',
    clientReferenceId: 'EVT-TICKET-REV-2026-000019',
    customerMessage: 'Payment for checkout EVT-TICKET-REV-2026-000019',
    created: '2026-09-23T13:13:41Z',
    metadata: [
      { orderId: '6234b131-c506-47d7-bdf6-522bc0cbd9ad' },
      { orderNumber: 'REV-2026-000019' }
    ]
  };

  it('accepts a completed deposit callback', () => {
    const result = pawapayUnifiedCallbackSchema.safeParse(realDepositCallback);
    expect(result.success).toBe(true);
  });

  it('accepts a failed deposit callback with a failure reason', () => {
    const result = pawapayUnifiedCallbackSchema.safeParse({
      ...realDepositCallback,
      status: 'FAILED',
      failureReason: {
        failureCode: 'PAYER_LIMIT_REACHED',
        failureMessage: 'The payer has reached their transaction limit.'
      }
    });
    expect(result.success).toBe(true);
  });

  /**
   * pawaPay documents metadata as an array of single-key objects on the way in,
   * but has also been observed echoing it back as a plain object.
   */
  it('accepts metadata as an object as well as an array', () => {
    const result = pawapayUnifiedCallbackSchema.safeParse({
      ...realDepositCallback,
      metadata: { orderNumber: 'REV-2026-000019', isPII: false }
    });
    expect(result.success).toBe(true);
  });

  it('accepts a callback carrying only the fields we depend on', () => {
    const result = pawapayUnifiedCallbackSchema.safeParse({
      depositId: 'a8e5501c-2618-4f8b-b317-af307ce3823b',
      status: 'COMPLETED'
    });
    expect(result.success).toBe(true);
  });

  /**
   * Unknown keys must pass through untouched: pawaPay adds fields over time and
   * a strict schema would turn a additive, backward-compatible change on their
   * side into every callback failing on ours.
   */
  it('tolerates fields we do not know about yet', () => {
    const result = pawapayUnifiedCallbackSchema.safeParse({
      ...realDepositCallback,
      someFutureField: { nested: true },
      anotherOne: 'value'
    });
    expect(result.success).toBe(true);
  });

  it('still rejects a body that is not a recognisable callback', () => {
    const result = pawapayUnifiedCallbackSchema.safeParse({ hello: 'world' });
    expect(result.success).toBe(false);
  });
});
