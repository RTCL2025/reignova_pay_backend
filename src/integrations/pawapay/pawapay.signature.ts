import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { pawapayClient, PawapayClient } from './pawapay.client.js';

/**
 * Maps pawaPay Signature-Input algorithm names to Node.js crypto algorithm identifiers.
 */
const ALG_MAP: Record<string, { hash: string; type: 'ecdsa' | 'rsa' | 'rsa-pss' }> = {
  'ecdsa-p256-sha256': { hash: 'SHA256', type: 'ecdsa' },
  'ecdsa-p384-sha384': { hash: 'SHA384', type: 'ecdsa' },
  'rsa-pss-sha512': { hash: 'SHA512', type: 'rsa-pss' },
  'rsa-v1_5-sha256': { hash: 'SHA256', type: 'rsa' }
};

/**
 * Parses the Signature-Input header to extract covered components and metadata.
 *
 * Example input:
 *   sig-pp=("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="KEY_ID";created=1714657551;expires=1714657611
 *
 * Returns the component names, algorithm, and raw params string.
 */
export function parseSignatureInput(signatureInput: string): {
  label: string;
  components: string[];
  alg: string;
  params: string;
  created?: number;
  keyid?: string;
} | null {
  // Match: label=(components);params
  const match = signatureInput.match(/^(\w[\w-]*)=\(([^)]*)\);?(.*)$/);
  if (!match) {
    return null;
  }

  const label = match[1];
  const componentsPart = match[2];
  const paramsPart = match[3] || '';

  // Parse component names: "component1" "component2" ...
  const components = Array.from(componentsPart.matchAll(/"([^"]+)"/g)).map((m) => m[1]);

  // Extract algorithm
  const algMatch = paramsPart.match(/alg="([^"]+)"/);
  const alg = algMatch ? algMatch[1] : 'ecdsa-p256-sha256';

  const createdMatch = paramsPart.match(/created=(\d+)/);
  const created = createdMatch ? parseInt(createdMatch[1], 10) : undefined;

  const keyidMatch = paramsPart.match(/keyid="([^"]+)"/);
  const keyid = keyidMatch ? keyidMatch[1] : undefined;

  return { label, components, alg, params: paramsPart, created, keyid };
}

/**
 * Calculates RFC 9530 Content-Digest for a body string/buffer.
 */
export function calculateContentDigest(body: string | Buffer, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
  const hash = crypto.createHash(algorithm).update(body).digest('base64');
  const prefix = algorithm === 'sha512' ? 'sha-512' : 'sha-256';
  return `${prefix}=:${hash}:`;
}

/**
 * Extracts the raw signature bytes from the Signature header.
 *
 * Example input:
 *   sig-pp=:MEQCIHFvGCUgyxmm...:
 *
 * Returns the base64-decoded signature as a Buffer.
 */
function extractSignatureBytes(signatureHeader: string, label: string): Buffer | null {
  // Match: label=:base64content:
  const regex = new RegExp(`${label}=:([A-Za-z0-9+/=]+):`);
  const match = signatureHeader.match(regex);
  if (!match || !match[1]) {
    return null;
  }
  return Buffer.from(match[1], 'base64');
}

/**
 * Builds the canonical RFC-9421 signature base from request headers and components.
 *
 * Per RFC-9421 §2.5, the signature base is constructed by concatenating
 * the covered components as:
 *   "component-name": component-value\n
 * followed by:
 *   "@signature-params": (components);params
 */
function buildSignatureBase(
  components: string[],
  headers: Record<string, string | string[] | undefined>,
  signatureInput: string,
  label: string,
  requestInfo?: { method?: string; authority?: string; path?: string }
): string {
  const lines: string[] = [];

  for (const component of components) {
    let value: string;

    if (component.startsWith('@')) {
      // Derived component
      switch (component) {
        case '@method':
          value = (requestInfo?.method || 'POST').toUpperCase();
          break;
        case '@authority':
          value = requestInfo?.authority || (getHeaderValue(headers, 'host') ?? 'localhost');
          break;
        case '@path':
          value = requestInfo?.path || '/';
          break;
        case '@request-target':
          value = `${(requestInfo?.method || 'POST').toLowerCase()} ${requestInfo?.path || '/'}`;
          break;
        case '@status':
          value = '200';
          break;
        default:
          logger.warn({ component }, 'Unknown derived component in signature base');
          continue;
      }
    } else {
      // Header component — case-insensitive lookup
      const headerVal = getHeaderValue(headers, component);
      if (headerVal === undefined) {
        logger.warn({ component }, 'Missing header for signature base component');
        continue;
      }
      value = headerVal;
    }

    lines.push(`"${component}": ${value}`);
  }

  // Extract the params portion: everything after label=(...) 
  const paramsMatch = signatureInput.match(new RegExp(`${label}=\\([^)]*\\);?(.*)`));
  const rawParams = paramsMatch ? paramsMatch[1] || '' : '';

  // Build @signature-params line
  const componentList = components.map((c) => `"${c}"`).join(' ');
  const sigParams = rawParams ? `(${componentList});${rawParams}` : `(${componentList})`;
  lines.push(`"@signature-params": ${sigParams}`);

  return lines.join('\n');
}

/**
 * Gets a header value with case-insensitive lookup.
 * Returns the first value if array, or the string value, or undefined.
 */
function getHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  // Try exact match first
  if (headers[name] !== undefined) {
    const val = headers[name];
    return Array.isArray(val) ? val[0] : val;
  }
  // Try lowercase
  const lower = name.toLowerCase();
  if (headers[lower] !== undefined) {
    const val = headers[lower];
    return Array.isArray(val) ? val[0] : val;
  }
  // Try case-insensitive scan
  for (const [key, val] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      return Array.isArray(val) ? val[0] : val;
    }
  }
  return undefined;
}

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
   * Verifies Content-Digest header against the raw request body.
   * Supports both SHA-256 and SHA-512 as per pawaPay v2 documentation.
   */
  verifyContentDigest(
    contentDigest: string,
    rawBody: Buffer
  ): boolean {
    // Match sha-256=:base64: or sha-512=:base64:
    const digestMatch = contentDigest.match(/sha-(256|512)=:([A-Za-z0-9+/=]+):/);
    if (!digestMatch || !digestMatch[1] || !digestMatch[2]) {
      logger.warn({ contentDigest }, 'Could not parse Content-Digest header format');
      return false;
    }

    const algo = digestMatch[1] === '512' ? 'sha512' : 'sha256';
    const expectedDigest = digestMatch[2];
    const computedDigest = crypto.createHash(algo).update(rawBody).digest('base64');

    if (computedDigest !== expectedDigest) {
      logger.warn(
        { algo, expected: expectedDigest, computed: computedDigest },
        'Content-Digest mismatch — request body may have been tampered with'
      );
      return false;
    }

    return true;
  }

  /**
   * Verifies RFC-9421 HTTP Message Signature on an incoming Pawapay webhook request.
   *
   * Per the pawaPay v2 Signatures documentation:
   * 1. Validate Content-Digest (body integrity)
   * 2. Construct the signature base from Signature-Input components
   * 3. Verify the signature using pawaPay's public key
   */
  async verifySignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody?: Buffer,
    requestInfo?: { method?: string; authority?: string; path?: string }
  ): Promise<boolean> {
    if (!env.PAWAPAY_VERIFY_CALLBACK_SIGNATURES) {
      // Signature verification disabled via environment
      return true;
    }

    const signature = getHeaderValue(headers, 'signature');
    const signatureInput = getHeaderValue(headers, 'signature-input');
    const contentDigest = getHeaderValue(headers, 'content-digest');

    if (!signature || !signatureInput) {
      logger.warn('Missing Pawapay signature headers on incoming webhook');
      return false;
    }

    // Step 1: Verify Content-Digest if present (body integrity check)
    if (contentDigest && rawBody) {
      if (!this.verifyContentDigest(contentDigest, rawBody)) {
        return false;
      }
    }

    // Step 2: Parse Signature-Input to determine components and algorithm
    const parsed = parseSignatureInput(signatureInput);
    if (!parsed) {
      logger.warn({ signatureInput }, 'Failed to parse Signature-Input header');
      return false;
    }

    // Step 3: Extract the raw signature bytes
    const signatureBytes = extractSignatureBytes(signature, parsed.label);
    if (!signatureBytes) {
      logger.warn({ signature: signature.substring(0, 50) }, 'Failed to extract signature bytes');
      return false;
    }

    // Step 4: Build the canonical signature base per RFC-9421
    const signatureBase = buildSignatureBase(
      parsed.components,
      headers,
      signatureInput,
      parsed.label,
      requestInfo
    );

    // Step 5: Verify the signature using the public key
    try {
      const publicKey = await this.getPublicKey();
      const algInfo = ALG_MAP[parsed.alg];

      if (!algInfo) {
        logger.warn({ alg: parsed.alg }, 'Unsupported signature algorithm');
        return false;
      }

      const verifier = crypto.createVerify(algInfo.hash);
      verifier.update(signatureBase);
      verifier.end();

      const isValid = verifier.verify(publicKey, signatureBytes);

      if (!isValid) {
        logger.warn(
          { alg: parsed.alg, label: parsed.label },
          'Pawapay callback signature verification failed'
        );
      }

      return isValid;
    } catch (error) {
      logger.warn({ error }, 'Error verifying Pawapay callback signature');
      return false;
    }
  }
}

export const pawapaySignatureVerifier = new PawapaySignatureVerifier();

/**
 * Standalone helper to verify a signature with an explicit public key.
 */
export function verifyPawapaySignature(
  headers: Record<string, string | string[] | undefined>,
  body: string | Buffer,
  path: string,
  publicKeyPem: string
): boolean {
  const verifier = new PawapaySignatureVerifier();
  // Override key fetching to use provided key
  (verifier as any).getPublicKey = async () => publicKeyPem;
  
  const rawBody = typeof body === 'string' ? Buffer.from(body) : body;
  const contentDigest = getHeaderValue(headers, 'content-digest');

  if (contentDigest) {
    if (!verifier.verifyContentDigest(contentDigest, rawBody)) {
      return false;
    }
  }

  const signature = getHeaderValue(headers, 'signature');
  const signatureInput = getHeaderValue(headers, 'signature-input');
  if (!signature || !signatureInput) return false;

  const parsed = parseSignatureInput(signatureInput);
  if (!parsed) return false;

  const signatureBytes = extractSignatureBytes(signature, parsed.label);
  if (!signatureBytes) return false;

  const signatureBase = buildSignatureBase(
    parsed.components,
    headers,
    signatureInput,
    parsed.label,
    { path, method: 'POST' }
  );

  try {
    const algInfo = ALG_MAP[parsed.alg];
    if (!algInfo) return false;

    const v = crypto.createVerify(algInfo.hash);
    v.update(signatureBase);
    return v.verify(publicKeyPem, signatureBytes);
  } catch {
    return false;
  }
}

export default pawapaySignatureVerifier;
