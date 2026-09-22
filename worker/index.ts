import { Container, getContainer } from '@cloudflare/containers';

/**
 * Cloudflare Worker entry point.
 *
 * This file is NOT part of the Express application and is never compiled into
 * `dist/`. It lives outside `src/` on purpose: `tsconfig.json` includes
 * `src/**` and the Dockerfile copies `src/`, so keeping the Worker here means
 * the container build never sees Workers-only types or imports.
 *
 * Responsibility is deliberately thin — route every request into the container
 * and get out of the way. All payment logic stays in `src/`, unchanged.
 */

export interface Env {
  PAY_BACKEND: DurableObjectNamespace<PayBackendContainer>;

  // Plain configuration — see the `vars` block in wrangler.jsonc.
  NODE_ENV: string;
  LOG_LEVEL: string;
  PAWAPAY_BASE_URL: string;
  CHECKOUT_BASE_URL: string;
  CORS_ORIGIN: string;
  RESEND_FROM_EMAIL: string;

  // Secrets — set with `wrangler secret put`, never committed to wrangler.jsonc.
  DATABASE_URL: string;
  ADMIN_API_KEY: string;
  API_KEY_PEPPER: string;
  PAWAPAY_API_TOKEN: string;
  RESEND_API_KEY: string;
}

/**
 * Builds the container's process environment.
 *
 * Every key the zod schema in `src/config/env.ts` requires must appear here.
 * `src/config/env.ts` calls `process.exit(1)` on a validation failure, which in
 * a container shows up only as an immediate exit with no application logs — so
 * a key missing here is expensive to diagnose. The `secrets.required` block in
 * wrangler.jsonc is the first line of defence; this function is the second.
 *
 * Values are coerced to strings and empty entries dropped, because the runtime
 * rejects a non-string env value and zod treats an absent key differently from
 * an empty one (`RESEND_API_KEY` is optional; an empty string would still
 * construct a Resend client with no credentials).
 */
function buildEnvVars(env: Env): Record<string, string> {
  const vars: Record<string, string | undefined> = {
    // Runtime
    NODE_ENV: env.NODE_ENV,
    PORT: '5000',
    LOG_LEVEL: env.LOG_LEVEL,

    // Database. DB_SSL is pinned to 'true': the guard in
    // src/config/database.ts refuses to start against a remote host without
    // it, and Supabase's pooler will happily accept plaintext if we let it.
    DATABASE_URL: env.DATABASE_URL,
    DB_SSL: 'true',
    DB_POOL_MIN: '2',
    DB_POOL_MAX: '10',

    // Credentials
    ADMIN_API_KEY: env.ADMIN_API_KEY,
    API_KEY_PEPPER: env.API_KEY_PEPPER,

    // pawaPay. Signature verification defaults to false for sandbox
    // convenience; in production an unsigned callback must not be trusted.
    PAWAPAY_BASE_URL: env.PAWAPAY_BASE_URL,
    PAWAPAY_API_TOKEN: env.PAWAPAY_API_TOKEN,
    PAWAPAY_VERIFY_CALLBACK_SIGNATURES: 'true',

    // Receipts
    RESEND_API_KEY: env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL,

    // Web
    CORS_ORIGIN: env.CORS_ORIGIN,
    CHECKOUT_BASE_URL: env.CHECKOUT_BASE_URL,
  };

  return Object.fromEntries(
    Object.entries(vars).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

export class PayBackendContainer extends Container<Env> {
  /** Matches EXPOSE 5000 in the Dockerfile and PORT in buildEnvVars(). */
  defaultPort = 5000;

  /**
   * Readiness probe. `/health` deliberately does not touch the database —
   * `/health/ready` is the one that does. Gating container startup on Supabase
   * being reachable would turn a transient database blip into a container that
   * never starts.
   *
   * If the container never reports ready during `wrangler dev`, delete this
   * line: the default port check (any HTTP response counts) is enough, and the
   * Express 404 handler answers it.
   */
  pingEndpoint = '/health';

  /**
   * COST KNOB. Memory and disk bill only while the container is awake, so this
   * value sets the monthly bill more than anything else does.
   *
   *   '15m'  ~ $7/month   1-3s cold start after each idle period
   *   '1h'   ~ $9/month   rarer cold starts
   *   '24h'  ~ $12/month  effectively always warm
   *
   * 15m is the approved configuration. pawaPay retries callbacks, so a cold
   * start on an inbound webhook costs latency, not a lost payment. Re-tune
   * after a week of real traffic — see docs/cloudflare-deployment.md section 6.
   */
  sleepAfter = '15m';

  envVars = buildEnvVars(this.env);

  override onStart(): void {
    console.log(JSON.stringify({ level: 'info', msg: 'pay-backend container started' }));
  }

  override onStop({ exitCode, reason }: { exitCode: number; reason: string }): void {
    console.log(
      JSON.stringify({ level: 'info', msg: 'pay-backend container stopped', exitCode, reason })
    );
  }

  override onError(error: unknown): never {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'pay-backend container error',
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      })
    );
    throw error;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // A single named instance means exactly one container process globally.
    //
    // This is deliberate, not a placeholder. Two things in src/ assume a single
    // process: the setInterval reconciliation cycle started in src/server.ts,
    // and the in-memory store behind src/middleware/rate-limit.middleware.ts.
    // Running N instances would give N reconciliation loops racing on the same
    // stale checkouts and N independent rate-limit counters.
    //
    // Section 5 of docs/cloudflare-deployment.md has the ordered steps to
    // remove both assumptions before raising max_instances.
    return getContainer(env.PAY_BACKEND, 'pay-backend-singleton').fetch(request);
  },
};
