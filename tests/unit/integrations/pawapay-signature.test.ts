import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import {
  verifyPawapaySignature,
  calculateContentDigest,
  parseSignatureInput
} from '../../../src/integrations/pawapay/pawapay.signature.js';

describe('pawaPay Signature Verification (RFC 9421)', () => {
  let privateKeyPem: string;
  let publicKeyPem: string;

  beforeAll(() => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    privateKeyPem = privateKey;
    publicKeyPem = publicKey;
  });

  describe('calculateContentDigest', () => {
    it('calculates SHA-256 content digest according to RFC 9530', () => {
      const body = JSON.stringify({ checkoutId: 'chk_123', status: 'COMPLETED' });
      const digest = calculateContentDigest(body, 'sha256');

      expect(digest).toMatch(/^sha-256=:[A-Za-z0-9+/=]+:$/);
      const expectedHash = crypto.createHash('sha256').update(body).digest('base64');
      expect(digest).toBe(`sha-256=:${expectedHash}:`);
    });

    it('calculates SHA-512 content digest when specified', () => {
      const body = JSON.stringify({ checkoutId: 'chk_123' });
      const digest = calculateContentDigest(body, 'sha512');

      expect(digest).toMatch(/^sha-512=:[A-Za-z0-9+/=]+:$/);
      const expectedHash = crypto.createHash('sha512').update(body).digest('base64');
      expect(digest).toBe(`sha-512=:${expectedHash}:`);
    });
  });

  describe('parseSignatureInput', () => {
    it('parses valid Signature-Input header', () => {
      const header = 'sig1=("@request-target" "content-digest");alg="rsa-v1_5-sha256";created=1600000000;keyid="pawapay-key-1"';
      const parsed = parseSignatureInput(header);

      expect(parsed).toEqual({
        label: 'sig1',
        components: ['@request-target', 'content-digest'],
        alg: 'rsa-v1_5-sha256',
        params: 'alg="rsa-v1_5-sha256";created=1600000000;keyid="pawapay-key-1"',
        created: 1600000000,
        keyid: 'pawapay-key-1'
      });
    });

    it('returns null for invalid header format', () => {
      expect(parseSignatureInput('')).toBeNull();
      expect(parseSignatureInput('invalid-header')).toBeNull();
    });
  });

  describe('verifyPawapaySignature (End-to-End RFC 9421)', () => {
    it('successfully verifies a valid signed request using RSA-SHA256', () => {
      const body = JSON.stringify({ checkoutId: 'chk_test_100', status: 'COMPLETED' });
      const path = '/api/v1/webhooks/pawapay';
      const digest = calculateContentDigest(body, 'sha256');

      const components = ['@request-target', 'content-digest'];
      const created = Math.floor(Date.now() / 1000);

      // Construct canonical signature base manually to sign
      const signatureBase = [
        `"@request-target": post ${path}`,
        `"content-digest": ${digest}`,
        `"@signature-params": ("@request-target" "content-digest");alg="rsa-v1_5-sha256";created=${created};keyid="test-key"`
      ].join('\n');

      const signer = crypto.createSign('RSA-SHA256');
      signer.update(signatureBase);
      const signatureBuffer = signer.sign(privateKeyPem);
      const signatureBase64 = signatureBuffer.toString('base64');

      const signatureInputHeader = `sig1=("@request-target" "content-digest");alg="rsa-v1_5-sha256";created=${created};keyid="test-key"`;
      const signatureHeader = `sig1=:${signatureBase64}:`;

      const headers = {
        'signature-input': signatureInputHeader,
        'signature': signatureHeader,
        'content-digest': digest
      };

      const isValid = verifyPawapaySignature(headers, body, path, publicKeyPem);
      expect(isValid).toBe(true);
    });

    it('rejects verification if the request body was tampered with', () => {
      const originalBody = JSON.stringify({ checkoutId: 'chk_test_100', status: 'COMPLETED' });
      const tamperedBody = JSON.stringify({ checkoutId: 'chk_test_100', status: 'FAILED' });
      const path = '/api/v1/webhooks/pawapay';
      const digest = calculateContentDigest(originalBody, 'sha256');

      const created = Math.floor(Date.now() / 1000);
      const signatureBase = [
        `"@request-target": post ${path}`,
        `"content-digest": ${digest}`,
        `"@signature-params": ("@request-target" "content-digest");alg="rsa-v1_5-sha256";created=${created};keyid="test-key"`
      ].join('\n');

      const signer = crypto.createSign('RSA-SHA256');
      signer.update(signatureBase);
      const signatureBase64 = signer.sign(privateKeyPem).toString('base64');

      const headers = {
        'signature-input': `sig1=("@request-target" "content-digest");alg="rsa-v1_5-sha256";created=${created};keyid="test-key"`,
        'signature': `sig1=:${signatureBase64}:`,
        'content-digest': digest
      };

      // Passing tampered body should fail digest comparison
      const isValid = verifyPawapaySignature(headers, tamperedBody, path, publicKeyPem);
      expect(isValid).toBe(false);
    });

    it('rejects verification if signature is missing or malformed', () => {
      const headers = {
        'content-digest': 'sha-256=:abc:'
      };
      expect(verifyPawapaySignature(headers, '{}', '/webhook', publicKeyPem)).toBe(false);
    });
  });
});
