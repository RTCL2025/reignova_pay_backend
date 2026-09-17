import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { pawapayClient, PawapayClient } from './pawapay.client.js';

export class PawapaySignatureVerifier {
  private cachedPublicKey: string | null = null;
  private keyCachedAt = 0;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(private readonly client: PawapayClient = pawapayClient) {}

  async getPublicKey(): Promise<string> {
    const now = Date.now();
    if (this.cachedPublicKey && now - this.keyCachedAt < this.CACHE_TTL_MS) {
      return this.cachedPublicKey;
    }

    try {
      const key = await this.client.getPublicKey();
      this.cachedPublicKey = key;
      this.keyCachedAt = now;
      return key;
    } catch (err) {
      logger.error({ err }, 'Failed to fetch Pawapay public key');
      if (this.cachedPublicKey) {
        return this.cachedPublicKey; // Return stale key if fetch fails
      }
      throw err;
    }
  }

  /**
   * Verifies RFC-9421 HTTP Message Signature on an incoming Pawapay webhook request.
   */
  async verifySignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody?: Buffer
  ): Promise<boolean> {
    if (!env.PAWAPAY_VERIFY_CALLBACK_SIGNATURES) {
      // Signature verification disabled via environment
      return true;
    }

    const signature = (headers['signature'] || headers['Signature']) as string | undefined;
    const signatureInput = (headers['signature-input'] || headers['Signature-Input']) as
      | string
      | undefined;
    const contentDigest = (headers['content-digest'] || headers['Content-Digest']) as
      | string
      | undefined;

    if (!signature || !signatureInput) {
      logger.warn('Missing Pawapay signature headers on incoming webhook');
      return false;
    }

    // Verify Content-Digest if present
    if (contentDigest && rawBody) {
      const digestMatch = contentDigest.match(/sha-256=:([A-Za-z0-9+/=]+):/);
      if (digestMatch && digestMatch[1]) {
        const expectedDigest = crypto
          .createHash('sha256')
          .update(rawBody)
          .digest('base64');
        if (digestMatch[1] !== expectedDigest) {
          logger.warn({ expectedDigest, actual: digestMatch[1] }, 'Content-Digest mismatch');
          return false;
        }
      }
    }

    try {
      const publicKey = await this.getPublicKey();
      // Verify signature over the canonical signature base using public key
      const verifier = crypto.createVerify('SHA256');
      verifier.update(signatureInput);
      verifier.end();

      const signatureBytes = Buffer.from(signature.replace(/^[^:]+:/, ''), 'base64');
      const isSignatureValid = verifier.verify(publicKey, signatureBytes);

      return isSignatureValid;
    } catch (error) {
      logger.warn({ error }, 'Error verifying Pawapay callback signature');
      return false;
    }
  }
}

export const pawapaySignatureVerifier = new PawapaySignatureVerifier();
export default pawapaySignatureVerifier;
