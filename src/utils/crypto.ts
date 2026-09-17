import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Generates a secure API key with prefix.
 * e.g., pk_live_a1b2c3d4e5f6... (32 random bytes in hex = 64 chars)
 */
export function generateApiKey(isTestMode = false): { apiKey: string; prefix: string } {
  const prefix = isTestMode ? 'pk_test_' : 'pk_live_';
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const apiKey = `${prefix}${randomBytes}`;
  return { apiKey, prefix };
}

/**
 * Generates a random secret for webhooks (32 bytes hex).
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Hashes an API key using SHA-256 and the system pepper.
 */
export function hashApiKey(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey + env.API_KEY_PEPPER)
    .digest('hex');
}

/**
 * Verifies if an incoming API key matches a stored hash in constant time.
 */
export function verifyApiKey(apiKey: string, storedHash: string): boolean {
  const computedHash = hashApiKey(apiKey);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Computes an HMAC-SHA256 signature for outgoing notifications.
 * format: t=<timestamp>,v1=<hmac>
 */
export function computeHmacSignature(payload: string, secret: string, timestamp: number): string {
  const signedPayload = `${timestamp}.${payload}`;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${hmac}`;
}

/**
 * Verifies an HMAC signature against payload and secret.
 */
export function verifyHmacSignature(
  payload: string,
  secret: string,
  signatureHeader: string,
  toleranceSeconds = 300
): boolean {
  const parts = signatureHeader.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signaturePart = parts.find((p) => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    return false;
  }

  const timestamp = parseInt(timestampPart.substring(2), 10);
  const signature = signaturePart.substring(3);

  if (Number.isNaN(timestamp)) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false; // Expired or future drift
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Canonical JSON hashing for idempotency payloads.
 */
export function hashPayload(payload: unknown): string {
  const jsonString = JSON.stringify(payload, Object.keys(payload || {}).sort());
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}
