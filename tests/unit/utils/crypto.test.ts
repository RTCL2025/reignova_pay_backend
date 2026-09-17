import { describe, it, expect } from 'vitest';
import {
  generateApiKey,
  generateWebhookSecret,
  hashApiKey,
  verifyApiKey,
  computeHmacSignature,
  verifyHmacSignature,
  hashPayload
} from '../../../src/utils/crypto.js';

describe('Crypto Utilities', () => {
  describe('API Key Generation & Verification', () => {
    it('should generate a live API key with pk_live_ prefix', () => {
      const { apiKey, prefix } = generateApiKey(false);
      expect(apiKey).toMatch(/^pk_live_[0-9a-f]{64}$/);
      expect(prefix).toBe('pk_live_');
    });

    it('should generate a test API key with pk_test_ prefix', () => {
      const { apiKey, prefix } = generateApiKey(true);
      expect(apiKey).toMatch(/^pk_test_[0-9a-f]{64}$/);
      expect(prefix).toBe('pk_test_');
    });

    it('should hash an API key deterministically and verify match', () => {
      const { apiKey } = generateApiKey();
      const hash1 = hashApiKey(apiKey);
      const hash2 = hashApiKey(apiKey);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
      expect(verifyApiKey(apiKey, hash1)).toBe(true);
    });

    it('should reject invalid API keys during verification', () => {
      const { apiKey } = generateApiKey();
      const hash = hashApiKey(apiKey);

      expect(verifyApiKey('pk_live_wrong_key', hash)).toBe(false);
      expect(verifyApiKey('', hash)).toBe(false);
    });

    it('should generate a webhook secret with whsec_ prefix', () => {
      const secret = generateWebhookSecret();
      expect(secret).toMatch(/^whsec_[0-9a-f]{64}$/);
    });
  });

  describe('HMAC-SHA256 Webhook Signatures', () => {
    const secret = 'whsec_test_secret_12345';
    const payload = JSON.stringify({ event: 'payment.completed', amount: 50000 });

    it('should generate and verify valid HMAC signature', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signatureHeader = computeHmacSignature(payload, secret, timestamp);

      expect(signatureHeader).toContain(`t=${timestamp},v1=`);
      const isValid = verifyHmacSignature(payload, secret, signatureHeader, 300);
      expect(isValid).toBe(true);
    });

    it('should reject signature if payload was tampered with', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signatureHeader = computeHmacSignature(payload, secret, timestamp);

      const tamperedPayload = JSON.stringify({ event: 'payment.completed', amount: 1 });
      const isValid = verifyHmacSignature(tamperedPayload, secret, signatureHeader, 300);
      expect(isValid).toBe(false);
    });

    it('should reject signature if wrong secret is used', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signatureHeader = computeHmacSignature(payload, 'wrong_secret', timestamp);

      const isValid = verifyHmacSignature(payload, secret, signatureHeader, 300);
      expect(isValid).toBe(false);
    });

    it('should reject expired signature when outside tolerance', () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
      const signatureHeader = computeHmacSignature(payload, secret, expiredTimestamp);

      // Tolerance is 300 seconds
      const isValid = verifyHmacSignature(payload, secret, signatureHeader, 300);
      expect(isValid).toBe(false);
    });

    it('should reject malformed signature header format', () => {
      expect(verifyHmacSignature(payload, secret, 'invalid_header', 300)).toBe(false);
      expect(verifyHmacSignature(payload, secret, 't=notanumber,v1=abc', 300)).toBe(false);
    });
  });

  describe('Payload Hashing for Idempotency', () => {
    it('should produce identical hash regardless of key ordering', () => {
      const obj1 = { a: 1, b: 2, c: 'hello' };
      const obj2 = { c: 'hello', a: 1, b: 2 };

      expect(hashPayload(obj1)).toBe(hashPayload(obj2));
    });

    it('should produce different hashes for different payloads', () => {
      const obj1 = { reference: 'REF-001', amount: 100 };
      const obj2 = { reference: 'REF-002', amount: 100 };

      expect(hashPayload(obj1)).not.toBe(hashPayload(obj2));
    });
  });
});
