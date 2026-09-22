# Cloudflare Workers Native Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run reignova-pay-backend natively on Cloudflare Workers — no container, no Node process — while keeping every payment behaviour byte-identical.

**Architecture:** Three phases, deliberately sequenced so the two risky changes never overlap. Phase 0 spikes the three runtime assumptions that can kill the design. Phase 1 replaces the Sequelize runtime with Drizzle + `node-postgres` **while the app still runs on Node**, gated by the existing 165-test suite against real Postgres. Phase 2 adapts the now-Workers-compatible app to the Workers runtime. Phase 3 deploys. After Phase 1 the app is still fully deployable the old way — that is the rollback.

**Tech Stack:** Cloudflare Workers (`nodejs_compat`), `httpServerHandler` from `cloudflare:node`, Hyperdrive, Drizzle ORM, `node-postgres`, Express 4 (unchanged), Vitest + `@cloudflare/vitest-pool-workers`, `sequelize-cli` retained for migrations only.

---

## Global Constraints

- **`compatibility_date`: `2026-09-01` minimum.** `node:http` *server* support requires `2025-09-01`+; `nodejs_compat` is on by default from `2026-08-04`.
- **`compatibility_flags`: `["nodejs_compat"]`** — explicit, even though defaulted, so the Worker does not change behaviour if the date is ever lowered.
- **Hyperdrive MUST be created with `--caching-disabled`.** See Risk R2. Non-negotiable for a payment ledger.
- **Database schema is `reignova_pay`, not `public`.** Every Drizzle table must be declared inside `pgSchema('reignova_pay')`.
- **Migrations stay on `sequelize-cli`.** The 12 existing `.cjs` migrations in `src/migrations/` encode production schema history. They run in Node from CI, never on Workers. Drizzle is a query builder here, **not** a migration tool. `drizzle-kit` is used only for `pull` (introspection).
- **No behaviour changes.** This is a runtime migration. Any bug found along the way gets its own ticket, not a drive-by fix.
- **Payment state transitions, idempotency, and webhook signature verification must be covered by a passing test before and after every task that touches them.**
- Node 20+, `pnpm@11.22.0`.
- Work on branch `feat/cloudflare-workers`, off `master` (currently `9fec2f5`).

---

## Risk register — read before starting

| | Risk | Impact | Mitigation |
|---|---|---|---|
| **R1** | **Interactive transactions may not survive Hyperdrive's pooling.** Cloudflare documents caching and connection pooling but is silent on `BEGIN`/`COMMIT`/`ROLLBACK` semantics. The codebase has 6 explicit transaction sites: `webhook.service.ts` (4×, lines 112/268/394/522) and `public-checkout.controller.ts` (2×, lines 316/361), plus `Transaction` threaded through `payment.service.ts`, `checkout.service.ts`, `notification.service.ts` and 5 repositories. | **Fatal if unmitigated.** A webhook that half-commits corrupts the payment ledger. | **Task 0.1 spike.** If it fails, fall back to connecting through the Supabase session pooler over `node:net` without Hyperdrive, or restructure the 6 sites into single-statement CTEs. Do not start Phase 1 until this is answered. |
| **R2** | **Hyperdrive caches reads for 60s by default and does not invalidate on write.** Cloudflare states plainly that it "does not purge or invalidate cached read query results when your application writes to your database." | **Fatal if unmitigated.** Create a checkout → immediately read it → miss. Mark a payment `COMPLETED` → reconciliation reads `PENDING` → double-processing. | Create the Hyperdrive config with `--caching-disabled`. Verified in Task 3.2. |
| **R3** | Sequelize leaks far past the repository layer: **46 model imports** across 8 services, 12 controllers, 1 middleware and 1 mapper; `Op` imported directly in 4 controllers; `sequelize.fn`/`sequelize.col` aggregates in `admin-stats.controller.ts:78-98`. | The repository layer is **not** a clean seam. Blast radius is ~37 files, not 6. | Phase 1 runs on Node with the full test suite green at every commit. Per-entity tasks, never a big-bang. |
| **R4** | `pino` + `pino-http` use worker threads and transports that do not exist on workerd. | Logging silently breaks or the Worker fails to boot. | Task 2.1 replaces both with a ~60-line console-backed structured logger. Workers Logs ingests JSON from `console.*`. |
| **R5** | `pdfkit` reads `.afm` font metrics from disk. Workers expose a read-only `/bundle` VFS, so it may work — reports say it needs Buffer shims (~500 KB, ~30% slower). | Receipts stop generating; payments still succeed. | **Task 0.3 spike.** Fallback: move receipt generation to a Queue consumer, or rewrite on `pdf-lib`. Not on the payment critical path — do not let it block the migration. |
| **R6** | The 165 existing tests run in Node via Vitest, not in workerd. Green tests do not prove the Worker works. | False confidence. | Phase 2 adds `@cloudflare/vitest-pool-workers` and re-runs the integration suite inside workerd (Task 2.8). |

---

## File Structure

**New files**

| File | Responsibility |
|---|---|
| `spikes/` (throwaway, deleted after Phase 0) | Phase 0 probe Workers |
| `src/db/schema/*.ts` | Drizzle table definitions, one file per entity, all inside `pgSchema('reignova_pay')` |
| `src/db/schema/index.ts` | Re-exports every table + the schema object Drizzle needs for relations |
| `src/db/client.ts` | Per-request `pg` Client + Drizzle instance factory; `withTransaction` helper |
| `src/db/types.ts` | `DbClient` / `DbExecutor` types — the transaction-or-connection union every repository accepts |
| `src/worker.ts` | Workers entry point: `fetch` (rate limit → Express) + `scheduled` (reconciliation) |
| `src/config/logger.ts` | **Rewritten** — console-backed structured logger, same call signature as pino |
| `src/middleware/request-log.middleware.ts` | Replaces `pino-http` |
| `src/routes/docs.routes.ts` | Replaces `swagger-ui-express`; serves Scalar over the bundled spec |
| `wrangler.jsonc` | Worker config, Hyperdrive binding, cron, rate-limit namespace |
| `drizzle.config.ts` | Introspection config only (`drizzle-kit pull`) |
| `.dev.vars` | Local secrets (gitignored) |

**Rewritten in Phase 1** — 9 models, 6 repositories, 8 services, 12 controllers, `authentication.middleware.ts`, `pawapay.mapper.ts`.

**Deleted at the end of Phase 1** — `src/models/*.model.ts`, `src/models/index.ts`, `src/config/database.ts`'s Sequelize instance (the `assertTlsForRemoteHost` guard moves to `src/db/client.ts` and keeps its test).

**Untouched** — `src/migrations/*.cjs`, `src/schemas/*.ts` (zod), `src/utils/*`, `src/integrations/pawapay/*` except `pawapay.mapper.ts`, `docs/openapi.yaml`.

---

# Phase 0 — Spikes

**Phase 0 gates everything.** Do not start Phase 1 until 0.1 passes. Budget half a day.

---

### Task 0.1: Prove interactive transactions work over Hyperdrive

**Files:**
- Create: `spikes/tx-probe/src/index.ts`
- Create: `spikes/tx-probe/wrangler.jsonc`

**Interfaces:**
- Consumes: nothing.
- Produces: a **go/no-go decision** recorded in this plan's Risk register. Phase 1's `withTransaction` design in Task 1.2 depends on the answer.

- [ ] **Step 1: Create the probe table in the dev database**

```bash
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS reignova_pay.spike_probe (id uuid PRIMARY KEY, note text);"
```

- [ ] **Step 2: Create the Hyperdrive config pointed at the dev database**

Use Supabase's **direct** connection string (not the pooler — Hyperdrive does its own pooling), and disable caching per R2:

```bash
npx wrangler hyperdrive create pay-db-dev --caching-disabled --connection-string="postgres://postgres:PASSWORD@db.YOUR-REF.supabase.co:5432/postgres"
```

Record the returned id into `spikes/tx-probe/wrangler.jsonc`:

```jsonc
{
  "name": "tx-probe",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<id-from-previous-command>" }]
}
```

- [ ] **Step 3: Write the probe**

```ts
import { Client } from 'pg';

interface Env {
  HYPERDRIVE: { connectionString: string };
}

export default {
  async fetch(_req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
    await client.connect();

    try {
      const before = await client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM reignova_pay.spike_probe'
      );

      await client.query('BEGIN');
      await client.query('INSERT INTO reignova_pay.spike_probe (id, note) VALUES ($1, $2)', [
        crypto.randomUUID(),
        'inside-tx',
      ]);
      const inside = await client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM reignova_pay.spike_probe'
      );
      await client.query('ROLLBACK');

      const after = await client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM reignova_pay.spike_probe'
      );

      const beforeN = before.rows[0]!.n;
      const insideN = inside.rows[0]!.n;
      const afterN = after.rows[0]!.n;

      return Response.json({
        beforeN,
        insideN,
        afterN,
        readYourWrites: insideN === beforeN + 1,
        rollbackWorked: afterN === beforeN,
        verdict: insideN === beforeN + 1 && afterN === beforeN ? 'PASS' : 'FAIL',
      });
    } finally {
      ctx.waitUntil(client.end());
    }
  },
};
```

- [ ] **Step 4: Run it against the real Hyperdrive**

```bash
cd spikes/tx-probe && npx wrangler dev --remote
```

Then, in another terminal:

```bash
curl -s http://localhost:8787 | jq
```

Expected: `{"readYourWrites": true, "rollbackWorked": true, "verdict": "PASS"}`.

- [ ] **Step 5: Interpret and record**

- `verdict: PASS` → Hyperdrive supports interactive transactions. Proceed to Phase 1 as written.
- `readYourWrites: false` → caching is still on. Recreate the config with `--caching-disabled` and re-run.
- `rollbackWorked: false` → **STOP.** Transactions are not safe. Record the failure in the Risk register and take R1's fallback: connect through the Supabase session pooler directly, skipping Hyperdrive. Re-run this probe against that connection string before continuing.

- [ ] **Step 6: Commit the spike result**

```bash
git add spikes/tx-probe docs/superpowers/plans/2026-09-22-cloudflare-workers-migration.md
git commit -m "spike: verify interactive transactions over Hyperdrive"
```

---

### Task 0.2: Prove node:crypto covers the signature surface

**Files:**
- Create: `spikes/crypto-probe/src/index.ts`
- Create: `spikes/crypto-probe/wrangler.jsonc`

**Interfaces:**
- Consumes: nothing.
- Produces: confirmation that `src/utils/crypto.ts` and `src/integrations/pawapay/pawapay.signature.ts` need no changes in Phase 1 or 2.

Workers' `node:crypto` is BoringSSL-backed, not OpenSSL. The codebase depends on `randomBytes`, `createHash('sha256')`, `createHmac('sha256')`, `timingSafeEqual`, and — in `pawapay.signature.ts` — verification across `ecdsa-p256-sha256`, `ecdsa-p384-sha384`, `rsa-pss-sha512` and `rsa-v1_5-sha256` (`ALG_MAP`, lines 9–14). ECDSA and RSA-PSS verification is the part worth proving.

- [ ] **Step 1: Write the probe**

```ts
import crypto from 'node:crypto';

export default {
  async fetch(): Promise<Response> {
    const results: Record<string, unknown> = {};

    results.randomBytes = crypto.randomBytes(32).toString('hex').length === 64;
    results.sha256 =
      crypto.createHash('sha256').update('abc').digest('hex') ===
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    results.hmac = crypto.createHmac('sha256', 'k').update('m').digest('hex').length === 64;
    results.timingSafeEqual = crypto.timingSafeEqual(
      Buffer.from('aabb', 'hex'),
      Buffer.from('aabb', 'hex')
    );

    for (const [label, opts] of [
      ['ecdsa-p256', { name: 'ec', namedCurve: 'prime256v1', hash: 'SHA256' }],
      ['ecdsa-p384', { name: 'ec', namedCurve: 'secp384r1', hash: 'SHA384' }],
      ['rsa-pss-sha512', { name: 'rsa', modulusLength: 2048, hash: 'SHA512' }],
      ['rsa-v1_5-sha256', { name: 'rsa', modulusLength: 2048, hash: 'SHA256' }],
    ] as const) {
      try {
        const { privateKey, publicKey } =
          opts.name === 'ec'
            ? crypto.generateKeyPairSync('ec', { namedCurve: opts.namedCurve })
            : crypto.generateKeyPairSync('rsa', { modulusLength: opts.modulusLength });

        const padding =
          label === 'rsa-pss-sha512'
            ? { padding: crypto.constants.RSA_PKCS1_PSS_PADDING }
            : {};

        const sig = crypto.sign(opts.hash, Buffer.from('payload'), { key: privateKey, ...padding });
        results[label] = crypto.verify(opts.hash, Buffer.from('payload'), { key: publicKey, ...padding }, sig);
      } catch (err) {
        results[label] = `THREW: ${(err as Error).message}`;
      }
    }

    const allPass = Object.values(results).every((v) => v === true);
    return Response.json({ ...results, verdict: allPass ? 'PASS' : 'FAIL' });
  },
};
```

`wrangler.jsonc` is the same as Task 0.1 minus the `hyperdrive` block.

- [ ] **Step 2: Run it**

```bash
cd spikes/crypto-probe && npx wrangler dev
```

```bash
curl -s http://localhost:8787 | jq
```

Expected: every key `true`, `verdict: "PASS"`.

- [ ] **Step 3: Interpret**

Any `THREW:` entry means that pawaPay signature algorithm cannot be verified on Workers. Record which. Mitigation is to reject callbacks signed with that algorithm and ask pawaPay to use a supported one — **never** to disable verification.

- [ ] **Step 4: Commit**

```bash
git add spikes/crypto-probe && git commit -m "spike: verify node:crypto signature algorithms on Workers"
```

---

### Task 0.3: Prove or disprove pdfkit on Workers

**Files:**
- Create: `spikes/pdf-probe/src/index.ts`
- Create: `spikes/pdf-probe/wrangler.jsonc`

**Interfaces:**
- Consumes: nothing.
- Produces: the decision for Task 2.7 — keep `pdfkit`, or move receipts to a Queue / `pdf-lib`.

- [ ] **Step 1: Write the probe**

This mirrors what `receipt.service.ts:generateReceiptPdf` actually does: default font, a vector path (the Reignova logo is an SVG path), and buffering to a `Buffer`.

```ts
import PDFDocument from 'pdfkit';

export default {
  async fetch(): Promise<Response> {
    try {
      const pdf: Buffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(18).text('Reignova receipt probe', 50, 50);
        doc.save().translate(50, 100).scale(0.05).path('M100,100 L200,200 L100,200 Z').fill('#F3A221').restore();
        doc.end();
      });

      return Response.json({
        verdict: 'PASS',
        bytes: pdf.length,
        isPdf: pdf.subarray(0, 4).toString() === '%PDF',
      });
    } catch (err) {
      return Response.json({ verdict: 'FAIL', error: (err as Error).message, stack: (err as Error).stack });
    }
  },
};
```

- [ ] **Step 2: Run it**

```bash
cd spikes/pdf-probe && npx wrangler dev
```

```bash
curl -s http://localhost:8787 | jq
```

Expected on success: `{"verdict":"PASS","isPdf":true,"bytes":<a few thousand>}`.

- [ ] **Step 3: Check the bundle cost**

```bash
npx wrangler deploy --dry-run --outdir dist && du -sh dist
```

The Workers limit is 64 MiB uncompressed, so size will not fail — but record the number, because `pdfkit` reportedly adds ~500 KB of Buffer shims and ~30% compute overhead.

- [ ] **Step 4: Record the decision**

- `PASS` → Task 2.7 is a no-op. Keep `receipt.service.ts` as-is.
- `FAIL` on font metrics (`.afm` / `ENOENT`) → Task 2.7 becomes: register a standard font explicitly from a bundled `.afm`, re-probe; if still failing, move receipt generation to a Queue consumer running on a Container, or rewrite on `pdf-lib`.

Receipts are **not** on the payment critical path — a failure here does not block Phase 1 or the cutover.

- [ ] **Step 5: Commit and clean up**

```bash
git add spikes/pdf-probe && git commit -m "spike: verify pdfkit on Workers runtime"
```

---

## Phase 0 gate

Do not proceed unless:

- [ ] 0.1 verdict is `PASS`, **or** the R1 fallback is chosen and re-probed to `PASS`.
- [ ] 0.2 verdict is `PASS`, or every failing algorithm is documented and accepted.
- [ ] 0.3 verdict is recorded (either outcome is acceptable).
- [ ] The Risk register above is updated in place with the three verdicts and the date.

---

# Phase 1 — Replace the Sequelize runtime, still on Node

**Why this phase runs on Node.** Changing the ORM and the runtime at the same time means every failure has two possible causes. Phase 1 keeps `pnpm dev:nodemon`, `docker compose up`, and all 165 tests against real Postgres on `localhost:5435`. The app stays deployable exactly as it is today until Phase 2 starts. **This is the rollback point.**

---

### Task 1.1: Introspect the live schema into Drizzle definitions

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/schema/` (generated, then hand-edited)
- Modify: `package.json` (add `db:pull` script)

**Interfaces:**
- Consumes: the live `reignova_pay` schema produced by the 12 `sequelize-cli` migrations.
- Produces: `src/db/schema/index.ts` exporting one Drizzle table object per entity — `applications`, `payments`, `paymentAttempts`, `webhookEvents`, `notifications`, `idempotencyKeys`, `auditLogs`, `checkouts`, `adminUsers`.

**Do not hand-write these tables.** Introspection guarantees the Drizzle definitions match what the migrations actually produced, including column types, nullability and defaults. Hand-writing 9 tables from the model files is how you get a silent `numeric` vs `text` mismatch in a payment amount.

- [ ] **Step 1: Install Drizzle**

```bash
pnpm add drizzle-orm && pnpm add -D drizzle-kit
```

- [ ] **Step 2: Write the introspection config**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/schema',
  schemaFilter: ['reignova_pay'],
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },
});
```

- [ ] **Step 3: Make sure the dev database is fully migrated first**

```bash
DATABASE_URL="<dev-url>" DB_SSL=true pnpm db:migrate:status
```

Every migration must read `up`. Introspecting a partially migrated database bakes the wrong shape into the code.

- [ ] **Step 4: Pull the schema**

```bash
DATABASE_URL="<dev-url>" DB_SSL=true npx drizzle-kit pull
```

- [ ] **Step 5: Verify the schema qualifier**

Open the generated file. Every table must be declared through `pgSchema('reignova_pay')`, not bare `pgTable`. If `drizzle-kit` emitted bare `pgTable`, wrap them:

```ts
import { pgSchema } from 'drizzle-orm/pg-core';

export const reignovaPay = pgSchema('reignova_pay');
export const checkouts = reignovaPay.table('checkouts', { /* generated columns */ });
```

A bare `pgTable` resolves against `search_path` and will silently read `public` — the exact failure `docs/superpowers/specs/2026-09-21-supabase-sequelize-cli-design.md` exists to prevent.

- [ ] **Step 6: Add the script**

In `package.json` scripts:

```json
"db:pull": "drizzle-kit pull"
```

- [ ] **Step 7: Verify the generated tables compile and match the models**

```bash
npx tsc --noEmit
```

Then eyeball one high-risk table against its model: `checkouts` must have `amounts` as `jsonb`, `expiresAt`/`completedAt`/`failedAt`/`expiredAt` as nullable timestamps, and `publicToken` nullable — compare against `CheckoutAttributes` in `src/models/checkout.model.ts:14-46`.

- [ ] **Step 8: Commit**

```bash
git add drizzle.config.ts src/db/schema package.json
git commit -m "feat(db): introspect reignova_pay schema into Drizzle definitions"
```

---

### Task 1.2: Build the connection factory and transaction helper

**Files:**
- Create: `src/db/client.ts`
- Create: `src/db/types.ts`
- Create: `tests/unit/db/tls-guard.test.ts`
- Modify: `tests/unit/config/database-ssl-guard.test.ts` (repoint imports)

**Interfaces:**
- Consumes: `src/db/schema/index.ts` from Task 1.1.
- Produces:
  - `type DbExecutor` — the union every repository method accepts in place of Sequelize's `Transaction`.
  - `createDb(connectionString: string): { db: NodePgDatabase<typeof schema>; close: () => Promise<void> }`
  - `withTransaction<T>(db: NodePgDatabase<typeof schema>, fn: (tx: DbExecutor) => Promise<T>): Promise<T>`
  - `assertTlsForRemoteHost(target: ConnectionTarget): void` — **moved verbatim** from `src/config/database.ts:38-60`, tests and doc comment intact.

The `DbExecutor` type is the single most important interface in this plan. Every repository method currently ends in `transaction?: Transaction`; after this task it ends in `executor: DbExecutor = db`. Getting this signature right once means the remaining 8 entity tasks are mechanical.

- [ ] **Step 1: Write the failing test for the TLS guard, moved**

The guard in `src/config/database.ts` must survive the migration unchanged — it is a deliberate fail-closed control, and `tests/unit/config/database-ssl-guard.test.ts` already covers it. Copy that test file to `tests/unit/db/tls-guard.test.ts` and repoint its import:

```ts
import { assertTlsForRemoteHost } from '../../../src/db/client.js';
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm vitest run tests/unit/db/tls-guard.test.ts
```

Expected: FAIL — `src/db/client.ts` does not exist.

- [ ] **Step 3: Write `src/db/types.ts`**

```ts
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type * as schema from './schema/index.js';

export type Db = NodePgDatabase<typeof schema>;

/**
 * Anything a repository can run a query against: either the connection itself
 * or an open transaction. Replaces Sequelize's optional `transaction?: Transaction`
 * parameter, which defaulted to "no transaction" and made it easy to silently
 * escape an enclosing transaction by forgetting to thread the handle through.
 * Here the executor is required, so escaping one is a type error.
 */
export type DbExecutor = Db | PgTransaction<never, typeof schema, never>;
```

- [ ] **Step 4: Write `src/db/client.ts`**

```ts
import { Client } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';
import type { Db, DbExecutor } from './types.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export const DB_SCHEMA = 'reignova_pay';

export interface ConnectionTarget {
  databaseUrl?: string;
  host: string;
  dbSsl: boolean;
}

/**
 * Refuse to start when a remote database would be reached without TLS.
 *
 * Moved verbatim from src/config/database.ts. Supabase's pooler accepts
 * plaintext connections — it does not enforce TLS. Since SSL here is opt-in via
 * DB_SSL, an unset or mistyped DB_SSL in a deployment would silently send this
 * service's credentials and payment data across the public internet in the
 * clear, with nothing failing or warning. Failing closed is the only way that
 * misconfiguration gets noticed.
 *
 * A host that cannot be parsed is treated as remote: an unknown target has not
 * been shown to be local, and guessing in the permissive direction is the whole
 * failure mode this guard exists to prevent.
 */
export function assertTlsForRemoteHost(target: ConnectionTarget): void {
  if (target.dbSsl) return;

  let host = target.host;
  if (target.databaseUrl) {
    try {
      host = new URL(target.databaseUrl).hostname;
    } catch {
      host = '';
    }
  }

  if (LOCAL_HOSTS.has(host)) return;

  throw new Error(
    `Refusing to connect to ${host ? `"${host}"` : 'an unparseable database host'} without TLS. ` +
      'DB_SSL is not "true", so credentials and payment data would cross the network in cleartext. ' +
      'Set DB_SSL=true for any non-local database.'
  );
}

export function createDb(connectionString: string, ssl: boolean): {
  db: Db;
  close: () => Promise<void>;
} {
  const client = new Client({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
  });

  const connected = client.connect();
  const db = drizzle(client, { schema }) as NodePgDatabase<typeof schema>;

  return {
    db,
    close: async () => {
      await connected.catch(() => undefined);
      await client.end().catch(() => undefined);
    },
  };
}

/**
 * Runs `fn` inside a transaction. Drizzle rolls back automatically if `fn`
 * throws, which replaces the explicit `await t.rollback()` in the catch blocks
 * at webhook.service.ts:112/268/394/522 and public-checkout.controller.ts:316/361.
 */
export async function withTransaction<T>(db: Db, fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx as DbExecutor));
}

export type { Db, DbExecutor };
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/db/tls-guard.test.ts
```

Expected: PASS, same assertions as the original Sequelize-era test.

- [ ] **Step 6: Verify the connection actually works end to end**

```bash
docker compose up -d
```

```bash
pnpm vitest run tests/unit/db
```

- [ ] **Step 7: Commit**

```bash
git add src/db tests/unit/db
git commit -m "feat(db): add Drizzle connection factory, executor type and transaction helper"
```

---

### Task 1.3: Migrate the Checkout entity — the canonical pattern

**Files:**
- Modify: `src/repositories/checkout.repository.ts` (full rewrite)
- Modify: `src/services/checkout.service.ts`, `src/services/checkout-reconciliation.service.ts`
- Modify: `src/controllers/checkout.controller.ts`, `src/controllers/public-checkout.controller.ts`, `src/controllers/admin/admin-checkout.controller.ts`
- Test: `tests/integration/checkout-lifecycle.test.ts`, `tests/integration/public-checkout.test.ts` (should pass unmodified)

**Interfaces:**
- Consumes: `checkouts` table from Task 1.1; `Db`, `DbExecutor`, `withTransaction` from Task 1.2.
- Produces: the pattern every remaining entity task follows —
  - `type Checkout = typeof checkouts.$inferSelect` replaces the Sequelize model class
  - `type NewCheckout = typeof checkouts.$inferInsert` replaces `CheckoutCreationAttributes`
  - `CheckoutStatus` enum **stays where it is** (`src/models/checkout.model.ts`) until Task 1.12 moves it to `src/db/schema/checkouts.ts` — it is imported in 14 places and moving it early creates churn
  - every `CheckoutRepository` method takes `executor: DbExecutor = db` as its last parameter

**Why Checkout first:** it is the entity with the most transaction sites (`public-checkout.controller.ts:316,361`) and the most complex query surface (`findByPublicToken` with an association include, `list` with filters and count). If the pattern survives Checkout, the other eight are easier.

- [ ] **Step 1: Run the existing tests to establish the green baseline**

```bash
docker compose up -d && pnpm vitest run tests/integration/checkout-lifecycle.test.ts tests/integration/public-checkout.test.ts
```

Expected: PASS. **Record the number of passing assertions.** These tests are the specification for this task — they must pass unmodified at the end.

- [ ] **Step 2: Rewrite the repository's read methods**

Translate each Sequelize call. The mapping for every method in `src/repositories/checkout.repository.ts`:

```ts
import { and, eq, gte, lte, desc, count } from 'drizzle-orm';
import { checkouts, applications } from '../db/schema/index.js';
import type { Db, DbExecutor } from '../db/types.js';

export type Checkout = typeof checkouts.$inferSelect;
export type NewCheckout = typeof checkouts.$inferInsert;

export class CheckoutRepository {
  constructor(private readonly db: Db) {}

  // Checkout.create(data, { transaction }) ->
  async create(data: NewCheckout, executor: DbExecutor = this.db): Promise<Checkout> {
    const [row] = await executor.insert(checkouts).values(data).returning();
    return row!;
  }

  // Checkout.findByPk(id) ->
  async findByPk(id: string, executor: DbExecutor = this.db): Promise<Checkout | null> {
    const [row] = await executor.select().from(checkouts).where(eq(checkouts.id, id)).limit(1);
    return row ?? null;
  }

  // Checkout.findOne({ where: { id, applicationId } }) ->
  async findById(id: string, applicationId: string, executor: DbExecutor = this.db): Promise<Checkout | null> {
    const [row] = await executor
      .select()
      .from(checkouts)
      .where(and(eq(checkouts.id, id), eq(checkouts.applicationId, applicationId)))
      .limit(1);
    return row ?? null;
  }

  // Checkout.findOne({ where: { publicToken }, include: ['application'] }) ->
  // Sequelize's `include` becomes an explicit join. The caller in
  // receipt.service.ts reads `checkout.application`, so the shape is preserved.
  async findByPublicToken(
    publicToken: string,
    includeApplication = false,
    executor: DbExecutor = this.db
  ): Promise<(Checkout & { application?: typeof applications.$inferSelect }) | null> {
    if (!includeApplication) {
      const [row] = await executor
        .select()
        .from(checkouts)
        .where(eq(checkouts.publicToken, publicToken))
        .limit(1);
      return row ?? null;
    }

    const [row] = await executor
      .select({ checkout: checkouts, application: applications })
      .from(checkouts)
      .leftJoin(applications, eq(checkouts.applicationId, applications.id))
      .where(eq(checkouts.publicToken, publicToken))
      .limit(1);

    return row ? { ...row.checkout, application: row.application ?? undefined } : null;
  }

  // findAndCountAll({ where, offset, limit }) -> two queries, same shape out
  async list(
    applicationId: string,
    filters: { status?: string; reference?: string; checkoutCode?: string; startDate?: Date; endDate?: Date },
    offset = 0,
    limit = 20,
    executor: DbExecutor = this.db
  ): Promise<{ rows: Checkout[]; count: number }> {
    const conditions = [eq(checkouts.applicationId, applicationId)];
    if (filters.status) conditions.push(eq(checkouts.status, filters.status));
    if (filters.reference) conditions.push(eq(checkouts.reference, filters.reference));
    if (filters.checkoutCode) conditions.push(eq(checkouts.checkoutCode, filters.checkoutCode));
    if (filters.startDate) conditions.push(gte(checkouts.createdAt, filters.startDate));
    if (filters.endDate) conditions.push(lte(checkouts.createdAt, filters.endDate));

    const where = and(...conditions);

    const [rows, [total]] = await Promise.all([
      executor.select().from(checkouts).where(where).orderBy(desc(checkouts.createdAt)).offset(offset).limit(limit),
      executor.select({ n: count() }).from(checkouts).where(where),
    ]);

    return { rows, count: Number(total?.n ?? 0) };
  }
}
```

Apply the same translation to `findByReference`, `findByCode`, `findByDepositId`, `findByProviderCheckoutId` and `findPendingForReconciliation` — each is a `findOne`/`findAll` with an `and(...)` of `eq` conditions.

- [ ] **Step 3: Replace instance mutation with explicit updates**

Sequelize model instances carry `.save()` and `.update()`. Drizzle rows are plain objects. Every `checkout.save()` / `checkout.update({...})` call site becomes a repository method:

```ts
  async update(
    id: string,
    patch: Partial<NewCheckout>,
    executor: DbExecutor = this.db
  ): Promise<Checkout> {
    const [row] = await executor
      .update(checkouts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(checkouts.id, id))
      .returning();
    return row!;
  }
```

Find every call site:

```bash
grep -rn "\.save()\|\.update(" src/services/checkout.service.ts src/controllers/checkout.controller.ts src/controllers/public-checkout.controller.ts src/controllers/admin/admin-checkout.controller.ts
```

Rewrite each to `checkoutRepository.update(id, patch, executor)`. **Note the behaviour change to watch for:** Sequelize's `.save()` mutates the in-memory instance; Drizzle's `.returning()` gives you a new object. Any code that reads `checkout.status` *after* saving must now read the returned row.

- [ ] **Step 4: Convert the two transaction sites**

`public-checkout.controller.ts:316` and `:361` currently read:

```ts
const t = await sequelize.transaction();
try {
  /* ... work ... */
  await t.commit();
} catch (err) {
  await t.rollback();
  throw err;
}
```

Becomes:

```ts
await withTransaction(db, async (tx) => {
  /* ... same work, threading `tx` where `t` went ... */
});
```

The explicit `commit`/`rollback` disappear — Drizzle commits on resolve and rolls back on throw.

- [ ] **Step 5: Run the checkout tests**

```bash
pnpm vitest run tests/integration/checkout-lifecycle.test.ts tests/integration/public-checkout.test.ts
```

Expected: PASS, same assertion count as Step 1. **Do not edit the tests to make them pass.** If a test fails, the translation is wrong.

- [ ] **Step 6: Run the whole suite to catch collateral damage**

```bash
pnpm test
```

Expected: everything that passed before still passes. Other entities still run on Sequelize at this point — that is fine, the two ORMs coexist during Phase 1.

- [ ] **Step 7: Commit**

```bash
git add src/repositories/checkout.repository.ts src/services src/controllers
git commit -m "refactor(db): migrate Checkout entity from Sequelize to Drizzle"
```

---

### Tasks 1.4 – 1.11: Remaining entities

Each follows Task 1.3 **exactly**: establish the green baseline, rewrite the repository, replace instance mutation with repository updates, convert transaction sites, run the entity's tests, run the full suite, commit.

Ordered by dependency and risk — leaves first, so a failure never blocks a downstream entity:

| Task | Entity | Repository | Transaction sites | Tests that gate it |
|---|---|---|---|---|
| 1.4 | `AuditLog` | *(none — direct model use in `admin-audit-log.controller.ts`)* | 0 | `tests/integration/admin-portal-endpoints.test.ts` |
| 1.5 | `AdminUser` | *(none — direct use in `admin-auth.controller.ts`, `admin-auth.middleware.ts`)* | 0 | `tests/integration/admin-portal-endpoints.test.ts` |
| 1.6 | `IdempotencyKey` | `idempotency.repository.ts` | threaded `Transaction` | `tests/unit/services/idempotency.test.ts` |
| 1.7 | `Application` | `application.repository.ts` | 0 | `tests/integration/application-management.test.ts` |
| 1.8 | `Notification` | `notification.repository.ts` | threaded `Transaction` | `tests/integration/payment-lifecycle.test.ts` |
| 1.9 | `WebhookEvent` | `webhook.repository.ts` | threaded `Transaction` | `tests/integration/payment-lifecycle.test.ts` |
| 1.10 | `PaymentAttempt` | *(via `payment.repository.ts`)* | threaded `Transaction` | `tests/integration/payment-lifecycle.test.ts` |
| 1.11 | `Payment` + `webhook.service.ts` | `payment.repository.ts` | **4** (`webhook.service.ts:112,268,394,522`) | `tests/integration/payment-lifecycle.test.ts`, `tests/integration/refund-lifecycle.test.ts`, `tests/integration/payout-lifecycle.test.ts`, `tests/e2e/payment-lifecycle.test.ts`, `tests/unit/services/payment-state-machine.test.ts` |

**Task 1.11 is the hardest task in this plan.** `Payment` carries the state machine, the self-referencing refund association (`Payment.hasMany(Payment, { as: 'refunds' })`), and all four webhook transactions. Do it last, alone, on its own commit, with the e2e suite green before and after.

**Task 1.10a — `admin-stats.controller.ts` aggregates.** Lines 78–98 use `sequelize.fn('COUNT'|'SUM'|'DATE', sequelize.col(...))` with `group` and `order`. These have no mechanical Drizzle equivalent; write them as `sql` template literals:

```ts
import { sql } from 'drizzle-orm';

const byDay = await db
  .select({
    day: sql<string>`date(${payments.createdAt})`.as('day'),
    volume: sql<string>`sum(${payments.amount})`.as('volume'),
    count: sql<number>`count(${payments.id})::int`.as('count'),
  })
  .from(payments)
  .where(eq(payments.applicationId, applicationId))
  .groupBy(sql`date(${payments.createdAt})`)
  .orderBy(sql`date(${payments.createdAt}) asc`);
```

Note `sum()` on a `numeric` column returns a **string** from `pg`, not a number — the Sequelize version had the same behaviour, so compare the endpoint's JSON output before and after rather than assuming.

---

### Task 1.12: Delete Sequelize from the runtime

**Files:**
- Delete: `src/models/*.model.ts`, `src/models/index.ts`
- Modify: `src/config/database.ts` (delete — guard already moved in Task 1.2)
- Modify: `src/routes/health.routes.ts` (replace `sequelize.authenticate()`)
- Modify: `package.json`
- Delete: `tests/unit/config/database-ssl-guard.test.ts` (superseded by `tests/unit/db/tls-guard.test.ts`)

**Interfaces:**
- Consumes: every entity migrated in 1.3–1.11.
- Produces: a `src/` tree with zero `import ... from 'sequelize'` outside `src/migrations/`.

- [ ] **Step 1: Move the enums out of the models before deleting them**

`CheckoutStatus`, `AdminUserRole`, `AdminUserStatus` and the payment status enum live in model files and are imported across the codebase. Move each to its schema file:

```bash
grep -rn "CheckoutStatus\|AdminUserRole\|AdminUserStatus" src/ --include="*.ts" -l
```

Move the enum declarations into `src/db/schema/<entity>.ts` and update every import. No value changes — these strings are persisted in the database.

- [ ] **Step 2: Rewrite the readiness probe**

`src/routes/health.routes.ts` calls `sequelize.authenticate()`. Replace:

```ts
healthRoutes.get('/ready', async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`select 1`);
    res.status(200).json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Database unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});
```

- [ ] **Step 3: Verify nothing imports Sequelize at runtime**

```bash
grep -rn "from 'sequelize'" src/ | grep -v "^src/migrations/"
```

Expected: **no output.**

- [ ] **Step 4: Delete the model layer**

```bash
git rm src/models/*.model.ts src/models/index.ts src/config/database.ts tests/unit/config/database-ssl-guard.test.ts
```

- [ ] **Step 5: Keep `sequelize-cli` as a dev dependency**

Migrations still run on it. Move `sequelize` and `sequelize-cli` from `dependencies` to `devDependencies` in `package.json`, and keep `pg`/`pg-hstore` in `dependencies` — Drizzle needs `pg` at runtime.

- [ ] **Step 6: Run everything**

```bash
npx tsc --noEmit && pnpm test
```

Expected: clean compile, all 165 tests pass.

- [ ] **Step 7: Verify the app still boots the old way — this is the rollback proof**

```bash
pnpm build && node dist/server.js
```

```bash
curl -i http://localhost:5000/health/ready
```

Expected: `200`, `"database": "connected"`. **Phase 1 is complete when this works.** The app is now Workers-compatible at the data layer but still a normal Node service.

- [ ] **Step 8: Commit and tag**

```bash
git add -A && git commit -m "refactor(db): remove Sequelize runtime, Drizzle only"
git tag phase-1-complete
```

---

# Phase 2 — Adapt to the Workers runtime

---

### Task 2.1: Replace pino with a Workers-compatible logger

**Files:**
- Modify: `src/config/logger.ts` (full rewrite)
- Create: `src/middleware/request-log.middleware.ts`
- Modify: `src/app.ts:48-56` (swap `pinoHttp` for the new middleware)
- Modify: `package.json` (drop `pino`, `pino-http`, `pino-pretty`)
- Test: `tests/unit/config/logger.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `logger` with the exact call shape the codebase already uses — `logger.info(obj, msg)`, `logger.error({ err }, msg)`, plus `fatal`/`warn`/`debug`/`trace` and `child(bindings)`. **The signature must not change**, or all 90 source files need edits.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from '../../../src/config/logger.js';

describe('logger', () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { spy = vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { spy.mockRestore(); });

  it('emits a single JSON line with level, msg and merged bindings', () => {
    createLogger('info').info({ paymentId: 'p1' }, 'payment created');
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line.level).toBe('info');
    expect(line.msg).toBe('payment created');
    expect(line.paymentId).toBe('p1');
  });

  it('serializes an Error into message, name and stack', () => {
    createLogger('info').error({ err: new Error('boom') }, 'failed');
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line.err.message).toBe('boom');
    expect(line.err.stack).toContain('Error: boom');
  });

  it('suppresses messages below the configured level', () => {
    createLogger('warn').info({}, 'should not appear');
    expect(spy).not.toHaveBeenCalled();
  });

  it('merges child bindings into every line', () => {
    createLogger('info').child({ requestId: 'r1' }).info({}, 'hello');
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line.requestId).toBe('r1');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm vitest run tests/unit/config/logger.test.ts
```

Expected: FAIL — `createLogger` is not exported.

- [ ] **Step 3: Write the logger**

```ts
const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 } as const;
export type Level = keyof typeof LEVELS;

export interface Logger {
  trace(obj: object, msg?: string): void;
  debug(obj: object, msg?: string): void;
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
  fatal(obj: object, msg?: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

function serializeErrors(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] =
      v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v;
  }
  return out;
}

export function createLogger(level: Level, bindings: Record<string, unknown> = {}): Logger {
  const threshold = LEVELS[level];

  const emit = (lvl: Level) => (obj: object, msg?: string) => {
    if (LEVELS[lvl] < threshold) return;
    // Workers Logs ingests structured JSON written to console.
    console.log(
      JSON.stringify({
        level: lvl,
        time: new Date().toISOString(),
        ...bindings,
        ...serializeErrors((obj ?? {}) as Record<string, unknown>),
        ...(msg ? { msg } : {}),
      })
    );
  };

  return {
    trace: emit('trace'),
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    fatal: emit('fatal'),
    child: (extra) => createLogger(level, { ...bindings, ...extra }),
  };
}

export const logger = createLogger((process.env.LOG_LEVEL as Level) ?? 'info');
export default logger;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/config/logger.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Replace `pino-http`**

`src/app.ts:48-56` configures `pinoHttp` with `autoLogging.ignore` for health routes and `genReqId` from the `x-request-id` header. Reproduce it:

```ts
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

const IGNORED = new Set(['/health', '/health/ready']);

export function requestLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (IGNORED.has(req.url)) return next();

  const start = Date.now();
  const log = logger.child({ requestId: (req.headers['x-request-id'] as string) ?? undefined });
  (req as Request & { log: typeof log }).log = log;

  res.on('finish', () => {
    log.info(
      { method: req.method, url: req.url, status: res.statusCode, durationMs: Date.now() - start },
      'request completed'
    );
  });

  next();
}
```

Swap it into `src/app.ts` in place of the `pinoHttp` block.

- [ ] **Step 6: Drop the dependencies and verify**

```bash
pnpm remove pino pino-http pino-pretty && npx tsc --noEmit && pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "refactor(logging): replace pino with Workers-compatible console logger"
```

---

### Task 2.2: Read configuration from Worker bindings

**Files:**
- Modify: `src/config/env.ts`
- Create: `src/config/bindings.ts`

**Interfaces:**
- Consumes: `createDb` from Task 1.2.
- Produces: `getEnv(): EnvConfig` — lazy, throws instead of exiting; `getHyperdriveUrl(): string`.

Two problems with the current `src/config/env.ts`:

1. **`process.exit(1)` at line 71.** Not meaningful on Workers. Must throw so the error surfaces in Workers Logs instead of silently terminating the isolate.
2. **`env.HYPERDRIVE.connectionString` is not in `process.env`.** Cloudflare populates `process.env` from vars and secrets (`nodejs_compat_populate_process_env`, default from `2025-04-01`) — so `ADMIN_API_KEY`, `PAWAPAY_API_TOKEN` etc. all work unchanged. Bindings do **not** appear there. Hyperdrive must be read from the binding.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseEnv } from '../../../src/config/env.js';

describe('parseEnv', () => {
  it('throws rather than exiting when configuration is invalid', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/Invalid environment configuration/);
  });

  it('returns parsed config for a valid environment', () => {
    const cfg = parseEnv({
      ADMIN_API_KEY: 'x'.repeat(16),
      API_KEY_PEPPER: 'y'.repeat(16),
      PAWAPAY_API_TOKEN: 'token',
    });
    expect(cfg.PORT).toBe(5000);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm vitest run tests/unit/config/env.test.ts
```

Expected: FAIL — `parseEnv` is not exported and takes no argument.

- [ ] **Step 3: Rewrite the bottom of `src/config/env.ts`**

Keep the zod schema exactly as it is. Replace only the `parseEnv` function and the module-level `env` export:

```ts
export function parseEnv(source: Record<string, unknown> = process.env): EnvConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    // Throw, never exit: on Workers process.exit kills the isolate without
    // surfacing the reason in Workers Logs.
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

let cached: EnvConfig | undefined;
export function getEnv(): EnvConfig {
  cached ??= parseEnv();
  return cached;
}
```

- [ ] **Step 4: Replace the eager `env` import across the codebase**

```bash
grep -rn "import { env }" src/ | wc -l
```

`env` is imported eagerly in ~15 files and read at module scope in some. On Workers, module scope runs before bindings exist. Change each `env.X` to `getEnv().X`. Verify none remain at module top level:

```bash
grep -rn "^const .* = env\.\|^export const .* = env\." src/
```

Expected: no output.

- [ ] **Step 5: Write `src/config/bindings.ts`**

```ts
import { env as workerEnv } from 'cloudflare:workers';

export interface WorkerBindings {
  HYPERDRIVE: { connectionString: string };
  PAY_RATE_LIMITER: { limit(opts: { key: string }): Promise<{ success: boolean }> };
}

export function getHyperdriveUrl(): string {
  const hyperdrive = (workerEnv as unknown as WorkerBindings).HYPERDRIVE;
  if (!hyperdrive?.connectionString) {
    throw new Error('HYPERDRIVE binding is missing. Check the hyperdrive block in wrangler.jsonc.');
  }
  return hyperdrive.connectionString;
}
```

- [ ] **Step 6: Run the tests**

```bash
pnpm vitest run tests/unit/config && pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "refactor(config): lazy env parsing, throw instead of exit, read Hyperdrive from bindings"
```

---

### Task 2.3: Add the Worker entry point

**Files:**
- Create: `src/worker.ts`
- Create: `wrangler.jsonc`
- Modify: `src/server.ts` (guard the Node-only startup path)
- Modify: `package.json` (add `cf:dev`, `cf:deploy`)

**Interfaces:**
- Consumes: `app` from `src/app.ts`; `getEnv` from Task 2.2.
- Produces: the deployed Worker's `fetch` and `scheduled` handlers.

- [ ] **Step 1: Install wrangler**

```bash
pnpm add -D wrangler
```

- [ ] **Step 2: Write `src/worker.ts`**

```ts
import { httpServerHandler } from 'cloudflare:node';
import { app } from './app.js';

// On Workers, listen() does not open a TCP socket — the port becomes an
// internal identifier that the fetch handler routes to.
app.listen(5000);

export default httpServerHandler({ port: 5000 });
```

- [ ] **Step 3: Guard the Node-only startup in `src/server.ts`**

`src/server.ts` calls `process.on('SIGTERM')`, `process.exit()` and `checkoutReconciliationService.start()` — none of which apply on Workers. It is only imported by `dist/server.js`, so it is not in the Worker bundle; leave it intact for local Node development, but confirm nothing pulls it in:

```bash
npx wrangler deploy --dry-run --outdir dist-worker && grep -c "SIGTERM" dist-worker/*.js || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Write `wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "reignova-pay-backend",
  "main": "src/worker.ts",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],

  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<id-from-task-3.2>" }],

  "ratelimits": [
    { "name": "PAY_RATE_LIMITER", "namespace_id": "1001", "simple": { "limit": 600, "period": 60 } }
  ],

  "triggers": { "crons": ["*/5 * * * *"] },

  "rules": [{ "type": "Text", "globs": ["**/*.yaml"], "fallthrough": true }],

  "vars": {
    "NODE_ENV": "production",
    "LOG_LEVEL": "info",
    "PAWAPAY_BASE_URL": "https://api.pawapay.cloud",
    "PAWAPAY_VERIFY_CALLBACK_SIGNATURES": "true",
    "CHECKOUT_BASE_URL": "https://pay.reignovatechnologies.com",
    "CORS_ORIGIN": "https://reignovatechnologies.com,https://pay.reignovatechnologies.com",
    "DB_SSL": "true"
  },

  "secrets": {
    "required": ["ADMIN_API_KEY", "API_KEY_PEPPER", "PAWAPAY_API_TOKEN", "RESEND_API_KEY"]
  },

  "observability": { "enabled": true },

  "routes": [{ "pattern": "pay-api.reignovatechnologies.com", "custom_domain": true }]
}
```

Note: `DATABASE_URL` is **not** a secret here — the connection string comes from the Hyperdrive binding.

- [ ] **Step 5: Add scripts to `package.json`**

```json
"cf:dev": "wrangler dev",
"cf:deploy": "wrangler deploy",
"cf:tail": "wrangler tail --format pretty"
```

- [ ] **Step 6: Verify it builds**

```bash
npx wrangler deploy --dry-run --outdir dist-worker
```

Expected: a successful bundle. Record the reported size; the limit is 64 MiB uncompressed.

- [ ] **Step 7: Commit**

```bash
git add src/worker.ts wrangler.jsonc package.json
git commit -m "feat(workers): add Worker entry point and wrangler configuration"
```

---

### Task 2.4: Move rate limiting to the Workers binding

**Files:**
- Modify: `src/worker.ts`
- Modify: `src/middleware/rate-limit.middleware.ts` (reduce to a no-op passthrough on Workers)
- Modify: `src/routes/index.ts`

**Interfaces:**
- Consumes: the `PAY_RATE_LIMITER` binding from Task 2.3.
- Produces: rate limiting enforced in `fetch` before Express sees the request.

`express-rate-limit`'s `MemoryStore` is per-isolate. With thousands of isolates the configured limit of 600/min becomes effectively unlimited. The Workers binding enforces at the edge — but note its documented behaviour: **per Cloudflare location and eventually consistent**, not an accurate counter.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { rateLimitKey } from '../../../src/worker-rate-limit.js';

describe('rateLimitKey', () => {
  it('keys authenticated traffic on the API key, not the IP', () => {
    const req = new Request('https://x/api/v1/payments', { headers: { authorization: 'Bearer pk_live_abc' } });
    expect(rateLimitKey(req)).toBe('key:pk_live_abc');
  });

  it('keys webhooks on the path so one merchant cannot starve another', () => {
    const req = new Request('https://x/api/v1/webhooks/pawapay');
    expect(rateLimitKey(req)).toBe('path:/api/v1/webhooks/pawapay');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm vitest run tests/unit/worker-rate-limit.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the key function and wire it into `fetch`**

```ts
export function rateLimitKey(request: Request): string {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return `key:${auth.slice(7)}`;
  return `path:${new URL(request.url).pathname}`;
}
```

In `src/worker.ts`, wrap the handler:

```ts
import { httpServerHandler } from 'cloudflare:node';
import { app } from './app.js';
import { rateLimitKey } from './worker-rate-limit.js';

app.listen(5000);
const nodeHandler = httpServerHandler({ port: 5000 });

export default {
  async fetch(request: Request, env: { PAY_RATE_LIMITER: { limit(o: { key: string }): Promise<{ success: boolean }> } }, ctx: ExecutionContext) {
    const { success } = await env.PAY_RATE_LIMITER.limit({ key: rateLimitKey(request) });
    if (!success) {
      return Response.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, { status: 429 });
    }
    return nodeHandler.fetch(request, env, ctx);
  },
};
```

- [ ] **Step 4: Remove the Express limiters from the route table**

Delete `publicRateLimiter`, `authenticatedRateLimiter` and `webhookRateLimiter` from the six `apiV1.use(...)` calls in `src/routes/index.ts:41-60`. Keep `src/middleware/rate-limit.middleware.ts` and the `RateLimitError` class — the error type is part of the public API contract.

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run tests/unit/worker-rate-limit.test.ts && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(workers): enforce rate limiting at the edge binding"
```

---

### Task 2.5: Replace swagger-ui-express

**Files:**
- Create: `src/routes/docs.routes.ts`
- Modify: `src/routes/index.ts:24-34`
- Modify: `package.json` (drop `swagger-ui-express`, `@types/swagger-ui-express`)

**Interfaces:**
- Consumes: the `rules` Text-module config from Task 2.3.
- Produces: `GET /docs` (HTML) and `GET /docs/openapi.yaml` (raw spec).

The current block reads `path.resolve(process.cwd(), 'docs', 'openapi.yaml')` inside a `try/catch` that swallows failure. On Workers this silently never mounts `/docs` — the worst failure mode, because nothing reports it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('GET /docs', () => {
  it('serves the API reference', async () => {
    const res = await request(app).get('/docs');
    expect(res.status).toBe(200);
    expect(res.text).toContain('openapi.yaml');
  });

  it('serves the raw spec', async () => {
    const res = await request(app).get('/docs/openapi.yaml');
    expect(res.status).toBe(200);
    expect(res.text).toContain('openapi:');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm vitest run tests/integration/docs.test.ts
```

Expected: FAIL — 404 on `/docs/openapi.yaml`.

- [ ] **Step 3: Write the route**

```ts
import { Router, Request, Response } from 'express';
// Bundled at build time as a Text module — see the `rules` block in wrangler.jsonc.
import openapiSpec from '../../docs/openapi.yaml';

export const docsRoutes: Router = Router();

docsRoutes.get('/openapi.yaml', (_req: Request, res: Response) => {
  res.type('text/yaml').send(openapiSpec);
});

docsRoutes.get('/', (_req: Request, res: Response) => {
  res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Reignova Pay API</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><script id="api-reference" data-url="/docs/openapi.yaml"></script>
<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script></body></html>`);
});
```

Add `declare module '*.yaml' { const content: string; export default content; }` to a `src/types/modules.d.ts`.

- [ ] **Step 4: Mount it and delete the old block**

Replace `src/routes/index.ts:24-34` with `routes.use('/docs', docsRoutes)`. The `try/catch` goes away — if the spec fails to bundle, the build should fail loudly.

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run tests/integration/docs.test.ts && pnpm remove swagger-ui-express @types/swagger-ui-express && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(docs): serve OpenAPI via bundled spec instead of swagger-ui-express"
```

---

### Task 2.6: Move reconciliation to a Cron Trigger

**Files:**
- Modify: `src/worker.ts` (add `scheduled`)
- Modify: `src/services/checkout-reconciliation.service.ts` (drop `start`/`stop`)
- Modify: `src/server.ts` (drop the `start()` call)
- Test: `tests/unit/services/checkout-reconciliation.test.ts`

**Interfaces:**
- Consumes: `checkoutReconciliationService.runCycle()` — already exists and already returns `{ checked, updated, errors }`, so it needs no changes.
- Produces: a `scheduled` handler invoked every 5 minutes by the cron in Task 2.3.

`runCycle()` is already written as a standalone async function. Only the `setInterval` wrapper (`start`/`stop`, lines 46–85) becomes dead code.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import worker from '../../src/worker.js';

describe('scheduled handler', () => {
  it('runs one reconciliation cycle and does not throw on partial failure', async () => {
    const runCycle = vi.fn().mockResolvedValue({ checked: 3, updated: 1, errors: 1 });
    const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
    await expect(
      worker.scheduled!({ cron: '*/5 * * * *' } as ScheduledController, { runCycle } as never, ctx)
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm vitest run tests/unit/services/checkout-reconciliation.test.ts
```

Expected: FAIL — `worker.scheduled` is undefined.

- [ ] **Step 3: Add the handler to `src/worker.ts`**

```ts
  async scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const { checkoutReconciliationService } = await import('./services/checkout-reconciliation.service.js');
        try {
          const result = await checkoutReconciliationService.runCycle();
          logger.info(result, 'reconciliation cycle complete');
        } catch (err) {
          // Never throw out of scheduled(): a throw retries the whole cron
          // invocation, which would re-poll pawaPay for checkouts already handled.
          logger.error({ err }, 'reconciliation cycle failed');
        }
      })()
    );
  },
```

Cron Triggers get 30 s CPU at intervals under an hour. The current batch size is 50 checkouts per cycle (`checkout-reconciliation.service.ts:41`), each making one pawaPay call — well inside the 1,000 subrequest limit, but watch the 6-simultaneous-connection cap, which the existing sequential `for` loop already respects.

- [ ] **Step 4: Delete the interval wrapper**

Remove `start()`, `stop()` and `intervalHandle` from `checkout-reconciliation.service.ts`. Remove the `.start()` and `.stop()` calls from `src/server.ts`.

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run tests/unit/services && pnpm test
```

- [ ] **Step 6: Test the cron locally**

```bash
npx wrangler dev
```

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"
```

Expected: a `reconciliation cycle complete` line in the dev output.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(workers): run checkout reconciliation on a cron trigger"
```

---

### Task 2.7: Resolve receipt generation

**Files:** depends on the Task 0.3 verdict.

- **0.3 PASS** → no work. Add `tests/integration/receipt-workers.test.ts` asserting `generateReceiptPdf` returns a `%PDF`-prefixed buffer inside workerd (Task 2.8's harness), and commit.
- **0.3 FAIL** → `receipt.service.ts:generateReceiptPdf` moves behind a Queue. The producer enqueues `{ checkoutId }` from the webhook path; the consumer runs on a Container with the existing `pdfkit` code untouched. Receipts become eventually-delivered, which they already effectively are — they are emailed via Resend, not returned synchronously.

Do not let this task block Task 3. Payments complete without receipts.

---

### Task 2.8: Run the integration suite inside workerd

**Files:**
- Create: `vitest.workers.config.ts`
- Modify: `package.json` (add `test:workers`)

**Interfaces:**
- Consumes: `wrangler.jsonc` from Task 2.3.
- Produces: proof that the Node-green suite is also workerd-green. This closes R6.

- [ ] **Step 1: Install the pool**

```bash
pnpm add -D @cloudflare/vitest-pool-workers
```

- [ ] **Step 2: Write the config**

```ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    include: ['tests/integration/**/*.test.ts', 'tests/e2e/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: { compatibilityFlags: ['nodejs_compat'] },
      },
    },
  },
});
```

- [ ] **Step 3: Add the script**

```json
"test:workers": "vitest run --config vitest.workers.config.ts"
```

- [ ] **Step 4: Run it**

```bash
pnpm test:workers
```

Expected: the same integration and e2e tests that pass under Node now pass under workerd. **Any test that passes in Node and fails here is a real Workers incompatibility** — fix the source, never the test.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test: run integration suite inside workerd"
git tag phase-2-complete
```

---

# Phase 3 — Deploy

---

### Task 3.1: Run migrations against production

- [ ] **Step 1: Migrate**

```bash
DATABASE_URL="<supabase-session-pooler-url>" DB_SSL=true pnpm db:migrate
```

- [ ] **Step 2: Verify**

```bash
DATABASE_URL="<supabase-session-pooler-url>" DB_SSL=true pnpm db:migrate:status
```

Every migration reads `up`. Migrations use the **session pooler**; the Worker uses **Hyperdrive over the direct connection**. Two different strings, both correct for their purpose.

---

### Task 3.2: Create the production Hyperdrive config

- [ ] **Step 1: Create it with caching disabled**

```bash
npx wrangler hyperdrive create pay-db-prod --caching-disabled --connection-string="postgres://postgres:PASSWORD@db.YOUR-REF.supabase.co:5432/postgres"
```

`--caching-disabled` is mandatory. See R2 — Hyperdrive does not invalidate cached reads on write, and a payment ledger cannot serve 60-second-stale rows.

- [ ] **Step 2: Put the returned id into `wrangler.jsonc`**

- [ ] **Step 3: Verify caching really is off**

```bash
npx wrangler hyperdrive get <id>
```

Expected: caching disabled in the output. If it is not, delete and recreate — do not deploy.

---

### Task 3.3: Set secrets and deploy

- [ ] **Step 1: Add `.dev.vars*` and `.wrangler/` to `.gitignore`**

`.gitignore` currently ignores `.env*` but not `.dev.vars*`, which is where Wrangler keeps local secrets.

- [ ] **Step 2: Set each secret**

```bash
npx wrangler secret put ADMIN_API_KEY
```

```bash
npx wrangler secret put API_KEY_PEPPER
```

```bash
npx wrangler secret put PAWAPAY_API_TOKEN
```

```bash
npx wrangler secret put RESEND_API_KEY
```

**`API_KEY_PEPPER` must be the same value already in production.** It is the salt for every stored merchant API key hash (`src/utils/crypto.ts:27`). A new pepper invalidates every merchant credential.

- [ ] **Step 3: Deploy**

```bash
npx wrangler deploy
```

- [ ] **Step 4: Verify before cutting traffic over**

```bash
curl -i https://reignova-pay-backend.<subdomain>.workers.dev/health/ready
```

Run the full check table below against the `workers.dev` URL **before** pointing the custom domain or the pawaPay callback at it.

---

### Task 3.4: Post-deploy verification

| Check | How | Expected |
|---|---|---|
| Liveness | `curl -i .../health` | `200`, `status: ok` |
| DB readiness through Hyperdrive | `curl -i .../health/ready` | `200`, `database: connected` |
| Read-after-write | Create a checkout, immediately `GET` it | Found. A miss means caching is still on — go back to Task 3.2 |
| Transactions | Replay a pawaPay webhook that fails mid-transition | Payment and checkout both unchanged, no half-write |
| Auth rejects anonymous | `curl -i .../api/v1/payments` | `401`, not `500` |
| Idempotency | Repeat one POST with the same `Idempotency-Key` | Identical response, one row |
| Signature verification | Send an unsigned callback | Rejected |
| Rate limiting | 700 requests in 60s with one API key | `429` before the end |
| Cron | `npx wrangler tail` for 5 minutes | `reconciliation cycle complete` |
| Docs | Open `/docs` | Scalar renders the spec |
| Receipts | Complete one sandbox checkout | Per the Task 0.3 / 2.7 outcome |
| Logs | `npx wrangler tail --format pretty` | Structured JSON lines, no pino errors |

---

### Task 3.5: Cut over

- [ ] Point `pay-api.reignovatechnologies.com` at the Worker (already in `routes`).
- [ ] Update the pawaPay callback URL.
- [ ] Update `reignova-events-frontend`'s payment service base URL.
- [ ] Keep the old deployment running and reachable for 48 hours.

**Rollback:** `npx wrangler rollback` reverts the Worker. If the problem is in the data layer, revert DNS to the old deployment — which still works, because Phase 1 left it deployable. That is the entire reason for the phase split.

---

## Self-review notes

- **Spec coverage:** all nine Path B items from `docs/cloudflare-deployment.md` §7 map to tasks — ORM (1.1–1.12), Hyperdrive (2.2, 3.2), pool sizing (1.2, per-request client), cron (2.6), `process.exit`/signals (2.2, 2.3), rate limiting (2.4), swagger (2.5), pdfkit (0.3, 2.7), bindings (2.2).
- **Two items were added that the original assessment missed:** pino (R4/2.1) and workerd-level testing (R6/2.8). Neither is optional.
- **Known gap:** Tasks 1.4–1.11 are specified as a table plus the Task 1.3 pattern rather than nine fully-expanded task bodies. This is deliberate — Task 0.1's verdict changes `withTransaction`'s design, and expanding 2,000 lines of task detail against an architecture a spike may invalidate is waste. Expand them after the Phase 0 gate passes.
