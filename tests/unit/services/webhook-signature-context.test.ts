import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookService } from '../../../src/services/webhook.service.js';
import type { PawapaySignatureVerifier } from '../../../src/integrations/pawapay/pawapay.signature.js';
import { AuthenticationError } from '../../../src/utils/errors.js';

/**
 * pawaPay signs its callbacks per RFC-9421 and its documented Signature-Input
 * covers `@method`, `@authority` and `@path`. The verifier accepts a
 * `requestInfo` argument for exactly this, but no caller ever passed one, so the
 * signature base was rebuilt with `@path` hardcoded to "/" — which cannot match
 * a signature computed over `/api/v1/webhooks/pawapay/checkouts`. With
 * PAWAPAY_VERIFY_CALLBACK_SIGNATURES pinned to 'true' in the deployed worker,
 * every signed callback would be rejected with a 401.
 */
describe('pawaPay callback signature request context (Unit)', () => {
  let verifier: PawapaySignatureVerifier;
  let service: WebhookService;

  const requestInfo = {
    method: 'POST',
    authority: 'pay-api.reignovatechnologies.com',
    path: '/api/v1/webhooks/pawapay/checkouts'
  };

  beforeEach(() => {
    verifier = {
      // Reject, so the call stops before any database work.
      verifySignature: vi.fn().mockResolvedValue(false)
    } as unknown as PawapaySignatureVerifier;

    service = new WebhookService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      verifier
    );
  });

  it('passes the real method, authority and path when verifying a deposit callback', async () => {
    await expect(
      service.processPawapayCallback({}, { depositId: 'dep-1' } as never, undefined, '1.2.3.4', requestInfo)
    ).rejects.toBeInstanceOf(AuthenticationError);

    expect(verifier.verifySignature).toHaveBeenCalledWith({}, undefined, requestInfo);
  });

  it('passes request context when verifying a checkout callback', async () => {
    await expect(
      service.processPawapayCheckoutCallback(
        {},
        { checkoutId: 'cs-1' } as never,
        undefined,
        '1.2.3.4',
        requestInfo
      )
    ).rejects.toBeInstanceOf(AuthenticationError);

    expect(verifier.verifySignature).toHaveBeenCalledWith({}, undefined, requestInfo);
  });

  it('passes request context when verifying a payout callback', async () => {
    await expect(
      service.processPawapayPayoutCallback(
        {},
        { payoutId: 'po-1' } as never,
        undefined,
        '1.2.3.4',
        requestInfo
      )
    ).rejects.toBeInstanceOf(AuthenticationError);

    expect(verifier.verifySignature).toHaveBeenCalledWith({}, undefined, requestInfo);
  });

  it('passes request context when verifying a refund callback', async () => {
    await expect(
      service.processPawapayRefundCallback(
        {},
        { refundId: 'rf-1' } as never,
        undefined,
        '1.2.3.4',
        requestInfo
      )
    ).rejects.toBeInstanceOf(AuthenticationError);

    expect(verifier.verifySignature).toHaveBeenCalledWith({}, undefined, requestInfo);
  });
});
