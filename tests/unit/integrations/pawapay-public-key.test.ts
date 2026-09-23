import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// Verification is off by default outside production, and `verifySignature`
// returns true immediately when it is — which would make every assertion here
// pass without exercising any cryptography. Turn it on, leaving the rest of the
// real configuration intact.
vi.mock('../../../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/config/env.js')>();
  return {
    ...actual,
    env: { ...actual.env, PAWAPAY_VERIFY_CALLBACK_SIGNATURES: true }
  };
});

import { PawapaySignatureVerifier, calculateContentDigest } from '../../../src/integrations/pawapay/pawapay.signature.js';
import type { PawapayClient } from '../../../src/integrations/pawapay/pawapay.client.js';

/**
 * pawaPay serves its callback verification keys as a JSON ARRAY:
 *
 *   [{"id":"HTTP_EC_P256_KEY:1","key":"-----BEGIN PUBLIC KEY-----\n..."}]
 *
 * The client tested `'key' in res.data`, which is false for an array, so it fell
 * through to `String(res.data)` and handed the verifier the literal string
 * "[object Object]". crypto then threw DECODER routines::unsupported, the throw
 * was swallowed into `return false`, and every signed callback was answered 401.
 * pawaPay reported this as "we tried to tell you about the final status of the
 * payment, but failed to send you a callback".
 */

const KEY_ID = 'HTTP_EC_P256_KEY:1';
const ROTATED_KEY_ID = 'HTTP_EC_P256_KEY:2';

function generateKeyPair() {
  return crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

interface SignedCallback {
  headers: Record<string, string>;
  rawBody: Buffer;
  requestInfo: { method: string; authority: string; path: string };
}

/**
 * Builds a callback signed the way pawaPay signs one, per its Signatures docs:
 * covered components @method, @authority, @path, signature-date, content-digest
 * and content-type, ecdsa-p256-sha256, and — as RFC-9421 requires for ECDSA —
 * a raw r||s signature rather than a DER-wrapped one.
 */
/**
 * A genuine sandbox callback, captured off the wire from pawaPay on
 * 2026-09-23 for deposit 10e7e1ca-c5dd-4152-af59-2d6a61700705, together with
 * the key that signed it. Nothing here is synthesised, so it pins the exact
 * behaviour production has to cope with — in particular that pawaPay's ECDSA
 * signature is DER-wrapped (it begins 0x30 0x46) rather than the raw r||s pair
 * RFC-9421 describes.
 */
const REAL_CALLBACK = {
  publicKeyPem:
    '-----BEGIN PUBLIC KEY-----\n' +
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEavII3g0Afh79ExaQzItBh0vEg85J\n' +
    'JlKmjY/776EaZOe0bAQU5oJrmaEeZQdKqBSXXzKUsCh6rHZKD8EkaIIH6g==\n' +
    '-----END PUBLIC KEY-----\n',
  keyId: 'HTTP_EC_P256_KEY:1',
  headers: {
    signature:
      'sig-pp=:MEYCIQD0ks6XJ87Bdz3DAICiyYvk3G+PH55x6kPjtsikACmDzgIhAK5hODjNtTfW/Up/v17LhveEEMBWlUWoxv5XPMcocKqH:',
    'signature-input':
      'sig-pp=("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="HTTP_EC_P256_KEY:1";created=1790171710;expires=1790171770',
    'signature-date': '2026-09-23T13:55:10.673817314Z',
    'content-digest':
      'sha-512=:nlU9HFYJ3DK9H2MoIsmo6Rtfi8zzIPD7aXYH3yFskeOomWOUlpGbBjN0WOWUjctMWmgPQp+HMyZYwDP8sTeSIA==:',
    'content-type': 'application/json',
    host: 'pay-api.reignovatechnologies.com'
  },
  requestInfo: {
    method: 'POST',
    authority: 'pay-api.reignovatechnologies.com',
    path: '/api/v1/webhooks/pawapay'
  }
};

describe('a real pawaPay callback captured from the wire (Unit)', () => {
  it('verifies, which the deployed code answered 401', async () => {
    const client = {
      getPublicKeys: vi
        .fn()
        .mockResolvedValue([{ id: REAL_CALLBACK.keyId, key: REAL_CALLBACK.publicKeyPem }])
    } as unknown as PawapayClient;

    const verifier = new PawapaySignatureVerifier(client);

    // The body is not replayed here, so the Content-Digest step is skipped and
    // this isolates the signature itself, which is what was failing.
    await expect(
      verifier.verifySignature(REAL_CALLBACK.headers, undefined, REAL_CALLBACK.requestInfo)
    ).resolves.toBe(true);
  });

  it('carries a DER-encoded signature, not the raw r||s pair', () => {
    const raw = REAL_CALLBACK.headers.signature.replace(/^sig-pp=:|:$/g, '');
    const bytes = Buffer.from(raw, 'base64');
    expect(bytes[0]).toBe(0x30); // ASN.1 SEQUENCE
    expect(bytes.length).toBeGreaterThan(64); // a raw P-256 pair is exactly 64
  });

  it('still rejects the real callback when the covered path is wrong', async () => {
    const client = {
      getPublicKeys: vi
        .fn()
        .mockResolvedValue([{ id: REAL_CALLBACK.keyId, key: REAL_CALLBACK.publicKeyPem }])
    } as unknown as PawapayClient;

    const verifier = new PawapaySignatureVerifier(client);

    await expect(
      verifier.verifySignature(REAL_CALLBACK.headers, undefined, {
        ...REAL_CALLBACK.requestInfo,
        path: '/api/v1/webhooks/pawapay/payouts'
      })
    ).resolves.toBe(false);
  });
});

function signCallback(privateKey: string, keyid: string, body: object): SignedCallback {
  const rawBody = Buffer.from(JSON.stringify(body));
  const authority = 'pay-api.reignovatechnologies.com';
  const path = '/api/v1/webhooks/pawapay';
  const signatureDate = new Date().toUTCString();
  const contentDigest = calculateContentDigest(rawBody, 'sha512');
  const contentType = 'application/json';
  const created = Math.floor(Date.now() / 1000);

  const components = [
    '@method',
    '@authority',
    '@path',
    'signature-date',
    'content-digest',
    'content-type'
  ];
  const componentList = components.map((c) => `"${c}"`).join(' ');
  const params = `alg="ecdsa-p256-sha256";keyid="${keyid}";created=${created}`;
  const signatureInput = `sig-pp=(${componentList});${params}`;

  const signatureBase = [
    `"@method": POST`,
    `"@authority": ${authority}`,
    `"@path": ${path}`,
    `"signature-date": ${signatureDate}`,
    `"content-digest": ${contentDigest}`,
    `"content-type": ${contentType}`,
    `"@signature-params": (${componentList});${params}`
  ].join('\n');

  const signature = crypto.sign('SHA256', Buffer.from(signatureBase), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363'
  });

  return {
    rawBody,
    requestInfo: { method: 'POST', authority, path },
    headers: {
      'content-type': contentType,
      'content-digest': contentDigest,
      'signature-date': signatureDate,
      'signature-input': signatureInput,
      signature: `sig-pp=:${signature.toString('base64')}:`
    }
  };
}

const DEPOSIT_BODY = {
  depositId: 'a8e5501c-2618-4f8b-b317-af307ce3823b',
  status: 'COMPLETED',
  amount: '35000',
  currency: 'TZS',
  clientReferenceId: 'EVT-TICKET-REV-2026-000019'
};

describe('pawaPay callback signature verification (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies a callback signed exactly as pawaPay signs one', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const client = {
      getPublicKeys: vi.fn().mockResolvedValue([{ id: KEY_ID, key: publicKey }])
    } as unknown as PawapayClient;

    const verifier = new PawapaySignatureVerifier(client);
    const { headers, rawBody, requestInfo } = signCallback(privateKey, KEY_ID, DEPOSIT_BODY);

    await expect(verifier.verifySignature(headers, rawBody, requestInfo)).resolves.toBe(true);
  });

  it('picks the key named by keyid when several are published', async () => {
    const wrong = generateKeyPair();
    const right = generateKeyPair();
    const client = {
      getPublicKeys: vi.fn().mockResolvedValue([
        { id: KEY_ID, key: wrong.publicKey },
        { id: ROTATED_KEY_ID, key: right.publicKey }
      ])
    } as unknown as PawapayClient;

    const verifier = new PawapaySignatureVerifier(client);
    const signed = signCallback(right.privateKey, ROTATED_KEY_ID, DEPOSIT_BODY);

    await expect(
      verifier.verifySignature(signed.headers, signed.rawBody, signed.requestInfo)
    ).resolves.toBe(true);
  });

  /**
   * Key rotation can publish a key under an id we have not seen, so an unknown
   * keyid must not be an automatic rejection — try the published keys instead.
   */
  it('falls back to the other published keys when keyid is unknown', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const client = {
      getPublicKeys: vi.fn().mockResolvedValue([{ id: 'SOME_OTHER_ID:9', key: publicKey }])
    } as unknown as PawapayClient;

    const verifier = new PawapaySignatureVerifier(client);
    const signed = signCallback(privateKey, 'UNPUBLISHED_KEY:7', DEPOSIT_BODY);

    await expect(
      verifier.verifySignature(signed.headers, signed.rawBody, signed.requestInfo)
    ).resolves.toBe(true);
  });

  it('rejects a callback signed by a key pawaPay does not publish', async () => {
    const published = generateKeyPair();
    const attacker = generateKeyPair();
    const client = {
      getPublicKeys: vi.fn().mockResolvedValue([{ id: KEY_ID, key: published.publicKey }])
    } as unknown as PawapayClient;

    const verifier = new PawapaySignatureVerifier(client);
    const signed = signCallback(attacker.privateKey, KEY_ID, DEPOSIT_BODY);

    await expect(
      verifier.verifySignature(signed.headers, signed.rawBody, signed.requestInfo)
    ).resolves.toBe(false);
  });

  it('rejects a callback whose body was altered after signing', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const client = {
      getPublicKeys: vi.fn().mockResolvedValue([{ id: KEY_ID, key: publicKey }])
    } as unknown as PawapayClient;

    const verifier = new PawapaySignatureVerifier(client);
    const signed = signCallback(privateKey, KEY_ID, DEPOSIT_BODY);
    const tampered = Buffer.from(JSON.stringify({ ...DEPOSIT_BODY, amount: '1' }));

    await expect(
      verifier.verifySignature(signed.headers, tampered, signed.requestInfo)
    ).resolves.toBe(false);
  });

  it('rejects when the signature covers a different path', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const client = {
      getPublicKeys: vi.fn().mockResolvedValue([{ id: KEY_ID, key: publicKey }])
    } as unknown as PawapayClient;

    const verifier = new PawapaySignatureVerifier(client);
    const signed = signCallback(privateKey, KEY_ID, DEPOSIT_BODY);

    await expect(
      verifier.verifySignature(signed.headers, signed.rawBody, {
        ...signed.requestInfo,
        path: '/api/v1/webhooks/pawapay/refunds'
      })
    ).resolves.toBe(false);
  });
});
