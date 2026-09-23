import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { pawapayClient, PawapayClient, PawapayPublicKey } from './pawapay.client.js';

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
  private cachedPublicKeys: PawapayPublicKey[] | null = null;
  private keyCachedAt = 0;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(private readonly client: PawapayClient = pawapayClient) {}

  async getPublicKeys(): Promise<PawapayPublicKey[]> {
    const now = Date.now();
    if (this.cachedPublicKeys && now - this.keyCachedAt < this.CACHE_TTL_MS) {
      return this.cachedPublicKeys;
    }

    try {
      const keys = await this.client.getPublicKeys();
      if (keys.length === 0) {
        throw new Error('pawaPay published no callback verification keys');
      }
      this.cachedPublicKeys = keys;
      this.keyCachedAt = now;
      return keys;
    } catch (err) {
      logger.error({ err }, 'Failed to fetch Pawapay public keys');
      if (this.cachedPublicKeys) {
        return this.cachedPublicKeys; // Serve the stale set rather than reject live callbacks
      }
      throw err;
    }
  }

  /** Back-compat helper: the first published key. */
  async getPublicKey(): Promise<string> {
    const keys = await this.getPublicKeys();
    return keys[0]!.key;
  }

  /**
   * Orders the published keys so the one named by `keyid` is tried first.
   *
   * Key rotation can sign with an id we have not cached yet, so an unrecognised
   * keyid falls back to trying every published key rather than rejecting the
   * callback outright — pawaPay does not re-deliver indefinitely.
   */
  private orderKeysForAttempt(
    keys: PawapayPublicKey[],
    keyid?: string
  ): PawapayPublicKey[] {
    if (!keyid) return keys;
    const named = keys.filter((k) => k.id === keyid);
    if (named.length === 0) return keys;
    return [...named, ...keys.filter((k) => k.id !== keyid)];
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

    // Step 5: Verify the signature against pawaPay's published keys
    try {
      const algInfo = ALG_MAP[parsed.alg];

      if (!algInfo) {
        logger.warn({ alg: parsed.alg }, 'Unsupported signature algorithm');
        return false;
      }

      const keys = this.orderKeysForAttempt(await this.getPublicKeys(), parsed.keyid);

      // ECDSA signatures arrive in one of two encodings and the two are not
      // interchangeable — feeding a DER signature to a p1363 verify throws
      // "Malformed signature", and vice versa.
      //
      // RFC-9421 specifies the raw r||s pair, but pawaPay actually sends a
      // DER-wrapped signature (a captured production callback began 0x30 0x46,
      // a DER SEQUENCE, and verified only under 'der'). DER is therefore tried
      // first, with p1363 kept as a fallback so a future move to the letter of
      // the spec does not break verification again.
      const encodings: Array<'der' | 'ieee-p1363'> =
        algInfo.type === 'ecdsa' ? ['der', 'ieee-p1363'] : ['der'];

      for (const candidate of keys) {
        for (const dsaEncoding of encodings) {
          // A malformed key, or a signature in the other encoding, makes crypto
          // throw rather than return false — so each attempt is isolated and one
          // failure must not discard the combination that would have verified.
          try {
            const verifier = crypto.createVerify(algInfo.hash);
            verifier.update(signatureBase);
            verifier.end();

            if (verifier.verify({ key: candidate.key, dsaEncoding }, signatureBytes)) {
              return true;
            }
          } catch (keyError) {
            logger.debug(
              { err: keyError, keyId: candidate.id, dsaEncoding },
              'Pawapay signature did not verify under this key and encoding'
            );
          }
        }
      }

      logger.warn(
        { alg: parsed.alg, label: parsed.label, keyid: parsed.keyid, keysTried: keys.length },
        'Pawapay callback signature verification failed'
      );
      return false;
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
