# Deploying reignova-pay-backend on Cloudflare

**Audience:** whoever is shipping this service to production.
**Status:** written 2026-09-22 against the Cloudflare docs as of that date.

---

## 0. Read this first — the verdict

This service **cannot be lifted onto Cloudflare Workers as-is.** It can be lifted onto **Cloudflare Containers** almost unchanged.

Cloudflare has two products that both count as "deploying on Cloudflare":

| | **Workers** (V8 isolates) | **Containers** (Linux VM, driven by a Worker) |
|---|---|---|
| Runtime | V8 + Node.js compat shims | Real Node 22, your Dockerfile |
| Our Express app | Works (`httpServerHandler`) | Works |
| **Sequelize + `pg`** | **Not supported by Cloudflare, reported to hang** | Works unchanged |
| `setInterval` reconciliation | Killed when the request ends | Works unchanged |
| `pdfkit` receipts | Unverified (needs `fs` font metrics) | Works unchanged |
| `swagger-ui-express` | Breaks (`process.cwd()` path) | Works unchanged |
| `express-rate-limit` memory store | Per-isolate → effectively unenforced | Works unchanged |
| `process.on('SIGTERM')`, `process.exit` | Not available | Works unchanged |
| Cost floor | ~$5/mo | **~$7/mo as configured** (see §6) |
| Cold start | None | 1–3 s after sleep |
| Work to get there | Multi-week rewrite | One afternoon |

**Recommendation: Path A (Containers).** It is a deployment, not a migration. Path B (Workers) is documented in §7 as a later optimisation, with the exact list of what must change.

The single hard blocker for Workers is Sequelize. Cloudflare documents Hyperdrive support for `node-postgres`, `Postgres.js`, Drizzle and Prisma — **Sequelize and TypeORM are not on that list**, and there are open reports of Sequelize hanging indefinitely on Workers with no error. This service has 9 Sequelize models and 6 repositories built on it. Replacing that layer in a payment service is not a deploy-day task.

---

## 1. Prerequisites

Before you start, have all of these:

- [ ] A Cloudflare account on the **Workers Paid plan** ($5/month). Containers are Paid-only.
- [ ] `reignovatechnologies.com` (or whichever zone will host the API) already on Cloudflare DNS.
- [ ] **Docker Desktop running locally.** `wrangler deploy` builds and pushes the image with Docker. Verify with `docker info`. On Windows, `wrangler deploy` works but `wrangler dev` does not — see Step 8.
- [ ] Node 20+ and `pnpm@11.22.0` (already pinned in `package.json`).
- [ ] The Supabase **session pooler** connection string, password percent-encoded, exactly as described in `.env.example`.
- [ ] Production `PAWAPAY_API_TOKEN` and `PAWAPAY_BASE_URL` (the live URL, not sandbox).
- [ ] `RESEND_API_KEY` for receipt delivery.
- [ ] Freshly generated production values for `ADMIN_API_KEY` and `API_KEY_PEPPER`. **Do not reuse the development pepper** — it is the salt for every stored client API key hash; changing it later invalidates every merchant credential.

---

## 2. Path A — Deploy on Cloudflare Containers

### Step 1 — Install the Cloudflare tooling

**Already done.** `wrangler`, `@cloudflare/containers` and `@cloudflare/workers-types` are in `devDependencies`. All three are build-time only — `wrangler` bundles the Worker on your machine, so none of them ship inside the container image, which is why they are not runtime dependencies.

`pnpm-workspace.yaml` also had to allow `workerd`'s build script (`allowBuilds: workerd: true`). Without it `pnpm` skips the postinstall that extracts the `workerd` binary and `wrangler dev` fails.

All you need to do is authenticate:

```bash
npx wrangler login
```

### Step 2 — Confirm the health endpoints

The `Container` class polls a `pingEndpoint` (default `ping`) to decide when the image is ready. Our Express 404 handler would answer it, but relying on a 404 as a readiness signal is fragile — `worker/index.ts` points it at the existing health route instead (`pingEndpoint = '/health'`). If the container never reports ready during `wrangler dev`, delete that line: the default port check accepts any HTTP response, and the 404 handler satisfies it.

Check `src/routes/health.routes.ts`: `GET /health` answers without touching the database, and the DB check lives on `/health/ready`. That split is exactly right here — container readiness must not be gated on Supabase being reachable, or a transient database blip turns into a container that never starts.

### Step 3 — The Worker entry point

**Already written: [`worker/index.ts`](../worker/index.ts).** Read it rather than re-deriving it — it is ~60 lines and every non-obvious line carries its reasoning.

It lives in `worker/`, **not** `src/`, on purpose. The root `tsconfig.json` compiles `src/**` to `dist/` for the container and the Dockerfile copies `src/`; keeping the Worker outside both means the container build never sees Workers-only types or imports. `worker/tsconfig.json` typechecks it separately, because `@cloudflare/workers-types` and `@types/node` both define `Request`, `Response` and `fetch` and cannot share one program.

Three things in it are decisions, not defaults:

- **`defaultPort = 5000`** matches `EXPOSE 5000` in the Dockerfile and the `PORT` value passed through `buildEnvVars()`. Change one, change all three.
- **`sleepAfter = '15m'`** is the cost knob. Memory and disk bill only while the container is awake, so this value sets the monthly bill more than anything else does. See §6.
- **`getContainer(env.PAY_BACKEND, 'pay-backend-singleton')`** pins traffic to exactly one container process globally. This is a correctness constraint, not a scaling choice — see §5.

`buildEnvVars()` is the part most likely to bite. Every key the zod schema in `src/config/env.ts` requires must appear there, because a missing key makes `src/config/env.ts` call `process.exit(1)`, which in a container looks like an immediate exit with no application logs.

### Step 4 — The Wrangler configuration

**Already written: [`wrangler.jsonc`](../wrangler.jsonc).**

Two things to confirm before your first deploy:

1. **`CHECKOUT_BASE_URL` and `CORS_ORIGIN`** under `vars` are placeholders pointing at `pay.reignovatechnologies.com` and the main site. `CHECKOUT_BASE_URL` builds the customer-facing checkout links, so a wrong value sends payers to a dead page.
2. **`routes` is commented out.** That is deliberate — the first deploy goes to `*.workers.dev` so you can run §3 against it without serving live traffic. Uncomment only after §3 passes.

`instance_type` is `basic` (1/4 vCPU, 1 GiB memory, 4 GB disk). `lite` is cheaper but has 256 MiB, and Node + Express + Sequelize idles near 100 MB before `pdfkit` buffers a whole receipt in memory. Do not drop to `lite` without load-testing receipt generation first.

### Step 5 — Confirm the Dockerfile is container-ready

The existing `Dockerfile` already works. Verify three things:

1. `EXPOSE 5000` matches `defaultPort = 5000` and the `PORT` env var. ✅
2. `COPY --from=builder /app/docs ./docs` is present — `src/routes/index.ts` reads `docs/openapi.yaml` relative to `process.cwd()`, which is `/app`. ✅
3. `.dockerignore` excludes every `.env` variant. ✅ (done — `.env*` was added, which also covers `.env.bak-presupabase`). This matters more than it looks: baking a development `.env` into the image would silently override the container `envVars` at runtime, because `src/config/env.ts` calls `dotenv.config()` before reading `process.env`. `worker/`, `wrangler.jsonc`, `spikes/` and `docs/superpowers/` are excluded too, to keep the image lean.

### Step 6 — Run the database migrations

Migrations run **from your machine or CI, never from the container** — multiple container starts would race each other.

```bash
DATABASE_URL="<supabase-session-pooler-url>" DB_SSL=true pnpm db:migrate
```

Verify:

```bash
DATABASE_URL="<supabase-session-pooler-url>" DB_SSL=true pnpm db:migrate:status
```

Every migration must read `up`. The service writes to the `reignova_pay` schema, not `public` — confirm the schema exists and the migrations landed there before continuing.

### Step 7 — Set the secrets

```bash
npx wrangler secret put DATABASE_URL
```

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

Each command prompts for the value and does not echo it. Confirm the set (names only, never values):

```bash
npx wrangler secret list
```

For local development, put the same keys in `.dev.vars`. **`.gitignore` currently ignores `.env*` but not `.dev.vars*`** — add these two lines before you create that file, or you will commit production secrets:

```
.dev.vars*
.wrangler/
```

### Step 8 — Test locally

> **`wrangler dev` does not work with containers on Windows.** It fails with
> *"Local development with containers is currently not supported on Windows. You
> should use WSL instead."* Verified on wrangler 4.135.0, 2026-09-22.
>
> Three ways around it, in order of usefulness:
>
> 1. **Run the container directly** (below) — tests the application, Supabase
>    connectivity and the env wiring, which is where the risk actually is. The
>    Worker layer it skips is a five-line router.
> 2. **Deploy to `*.workers.dev`** and run §3 there. `routes` is commented out,
>    so this serves no real traffic and it tests the real thing.
> 3. **Run `npx wrangler dev` inside WSL** if you need the full local loop.

Run the image with the same environment the Worker will pass it. `--env-file`
takes `.dev.vars` directly, since neither file quotes its values:

```bash
docker build -t reignova-pay-local . && docker run -d --name reignova-pay-local -p 5001:5000 --env-file .dev.vars -e NODE_ENV=production -e PORT=5000 -e LOG_LEVEL=info -e DB_SSL=true -e DB_POOL_MIN=2 -e DB_POOL_MAX=10 -e PAWAPAY_BASE_URL=https://api.sandbox.pawapay.cloud -e PAWAPAY_VERIFY_CALLBACK_SIGNATURES=true -e CORS_ORIGIN=https://pay.reignovatechnologies.com -e CHECKOUT_BASE_URL=https://pay.reignovatechnologies.com reignova-pay-local
```

Then:

```bash
curl -s http://localhost:5001/health/ready && curl -sL -o /dev/null -w "docs=%{http_code}\n" http://localhost:5001/docs && curl -s -o /dev/null -w "anon=%{http_code}\n" http://localhost:5001/api/v1/payments
```

Expected — and confirmed passing on 2026-09-22:

- `/health/ready` → `{"status":"ready","database":"connected",...}`. A 503 means the container cannot reach Supabase: a `DATABASE_URL` or TLS problem, not a Cloudflare one.
- `docs=200` (via a 301 to `/docs/`) — proves `docs/openapi.yaml` is in the image.
- `anon=401`, not 500 — authentication rejects cleanly.

Check the startup logs too:

```bash
docker logs reignova-pay-local | head -5
```

You want `Database connection established successfully`, `Payment Service running on port 5000` with `"env":"production"`, and `Starting checkout reconciliation cycle`.

Clean up when done:

```bash
docker rm -f reignova-pay-local && docker rmi -f reignova-pay-local
```

Then exercise one real path end to end — create an application, then a checkout — against the pawaPay **sandbox** before you flip `PAWAPAY_BASE_URL` at cutover.

### Step 9 — Deploy

```bash
npx wrangler deploy
```

This builds the image, pushes it to Cloudflare's registry, creates the Durable Object class, and rolls out the Worker. The first deploy takes several minutes because of the image push; later deploys only push changed layers.

### Step 10 — Point the custom domain and verify

The `routes` entry with `custom_domain: true` creates the DNS record and certificate automatically, provided the zone is on your Cloudflare account. Wait for the certificate, then:

```bash
curl -i https://pay-api.reignovatechnologies.com/health/ready
```

Watch the logs live during the first requests:

```bash
npx wrangler tail --format pretty
```

Container `stdout`/`stderr` is forwarded to Workers Logs, so the existing `pino` JSON output shows up here unchanged. The first request after a deploy pays the 1–3 s cold start; subsequent ones should not, until `sleepAfter` expires.

### Step 11 — Cutover

Only after §3 passes against the `*.workers.dev` URL.

**These five move together, in one change.** Doing them piecemeal leaves a window where the service is live on a real domain but still pointed at sandbox, or holds a live pawaPay token while the callback URL still points at the old deployment.

1. **`PAWAPAY_BASE_URL`** in `wrangler.jsonc` → `https://api.pawapay.cloud`.
2. **`PAWAPAY_API_TOKEN`** → `npx wrangler secret put PAWAPAY_API_TOKEN` with the live token.
3. **`routes`** in `wrangler.jsonc` → uncomment, with the API hostname you have settled on.
4. **pawaPay callback URL** → `https://<api-hostname>/api/v1/webhooks/...` (take the exact path from `src/routes/webhook.routes.ts`).
5. **`npx wrangler deploy`**, then re-run the §3 table against the real domain.

`CHECKOUT_BASE_URL` and `CORS_ORIGIN` are already set to `https://pay.reignovatechnologies.com` and do not change at cutover — that is the hosted checkout and admin portal origin, not this API's.

**Open decision:** the API hostname. `pay-api.reignovatechnologies.com` appears in this document as a placeholder and is not an existing decision anywhere in the codebase — `pay.reignovatechnologies.com` is already taken by the Next.js checkout frontend, so the API needs its own name. Settle it before step 3 above.

---

## 3. Post-deploy verification

Do not declare the deploy done until every line below has been observed, not assumed.

| Check | Command / action | Expected |
|---|---|---|
| Liveness | `curl -i https://pay-api.../health` | `200`, `status: ok` |
| DB readiness | `curl -i https://pay-api.../health/ready` | `200`, `database: connected` |
| TLS guard active | Container logs on start | No `Refusing to connect … without TLS` |
| API docs | Open `/docs` in a browser | Swagger UI renders |
| Auth rejects anonymous | `curl -i https://pay-api.../api/v1/payments` | `401`, not `500` |
| Admin key works | `curl -H "Admin-Api-Key: …" .../api/v1/admin/stats` | `200` |
| Idempotency | Repeat one POST with the same `Idempotency-Key` | Identical response, one DB row |
| Webhook signature | Send an unsigned callback | Rejected |
| Reconciliation loop | Logs after ~5 min | `Reconciliation cycle complete` |
| Receipt PDF | Complete one sandbox checkout | Email delivered with attachment |
| Cold start | Wait past `sleepAfter`, then request | Recovers, no error |

The reconciliation and receipt checks matter most — those are the two things that work in Docker and would silently not work on a misconfigured serverless deploy.

---

## 4. Rollback

```bash
npx wrangler deployments list
```

```bash
npx wrangler rollback
```

Rollback reverts the Worker and its container configuration to a previous version. It does **not** revert Sequelize migrations. If the failed deploy included a schema change, roll the Worker back first so no traffic hits an app expecting the newer schema, then undo the migration:

```bash
DATABASE_URL="<supabase-session-pooler-url>" DB_SSL=true pnpm db:migrate:undo
```

**Escalation:** if the container will not start at all, `wrangler tail` shows the `onError` output and the container exit code. An exit immediately after start with no application logs almost always means `src/config/env.ts` failed zod validation and called `process.exit(1)` — compare `envVars` in `worker/index.ts` against the schema in `src/config/env.ts` field by field.

---

## 5. Scaling past one instance

`max_instances: 1` with a named singleton is correct for launch and wrong for growth. Two things in the codebase assume a single process:

1. **`checkoutReconciliationService`** (`src/services/checkout-reconciliation.service.ts`) runs a `setInterval` started in `src/server.ts`. N instances means N concurrent reconciliation cycles racing on the same rows.
2. **`express-rate-limit`** (`src/middleware/rate-limit.middleware.ts`) uses the default in-memory store. N instances means N independent counters, so the effective limit is N× the configured one.

To scale out, in this order:

1. Remove `checkoutReconciliationService.start()` from `src/server.ts`. Expose `runCycle()` behind an internal, admin-authenticated route.
2. Add a Cron Trigger to `wrangler.jsonc` and a `scheduled` handler in `worker/index.ts` that calls that route on one dedicated singleton container:

   ```jsonc
   "triggers": { "crons": ["*/5 * * * *"] }
   ```

   Cron Triggers run on UTC, allow 30 s CPU per invocation at intervals under an hour, and take up to 15 minutes to propagate after a config change.
3. Replace `express-rate-limit` with the Workers Rate Limiting binding, applied in `worker/index.ts` *before* the request reaches the container. Note its documented behaviour: limits are **per Cloudflare location and eventually consistent**, not an accurate accounting system. Key on `application.id`, not IP — mobile money users share IPs heavily.
4. Only then raise `max_instances` and switch the default export to `getRandom(env.PAY_BACKEND, n)` for API traffic, keeping the named singleton for the cron path.

---

## 6. What this costs

Workers Paid is $5/month. On top of that, containers bill **memory and disk on the instance size you provision, but only while the container is awake**, and **CPU only while it is actually executing**. Billing starts when a request arrives or the container is manually started, and stops once it sleeps.

Rates: memory $0.0000025/GiB-second, disk $0.00000007/GB-second, CPU $0.000020/vCPU-second.
Included free each month: 25 GiB-hours memory, 200 GB-hours disk, 375 vCPU-minutes, 1 TB egress (NA/EU).

| Setup | Memory | Disk | CPU | **Total/mo** |
|---|---|---|---|---|
| `lite` (256 MiB, 2 GB), always awake | $1.42 | $0.32 | $0 | $6.74 |
| **`basic`, `sleepAfter = '15m'` — as configured** | **$1.94** | **$0.19** | **$0** | **≈ $7.13** |
| `basic` (1 GiB, 4 GB), always awake | $6.35 | $0.69 | $0–0.86 | $12.03–12.90 |
| `standard-1` (4 GiB, 8 GB), always awake, 10% CPU duty | $26.06 | $1.42 | $2.18 | $34.65 |

The configured row assumes the container is awake roughly 8 hours a day (240 h/month), which is what `sleepAfter = '15m'` produces when traffic is spread across a working day. **Check the real number after a week** — awake hours, not request count, drive this bill.

Egress is free at this volume; a payment API's JSON is nowhere near 1 TB. The Durable Object that drives the container also lands inside the free 400,000 GB-s of DO duration, so it adds $0. Workers requests are well inside the included 10 million.

`sleepAfter` is the only knob that matters: `'15m'` ≈ $7, `'1h'` ≈ $9, `'24h'` ≈ $12. The cost is a 1–3 s cold start on the first request after each idle period. pawaPay retries callbacks, so that is latency, not a lost payment.

**For comparison, Path B (native Workers) runs at $5/month** — Hyperdrive is unlimited queries at no extra charge. The difference is about **$2/month**, against a multi-week rewrite of the persistence layer. Path B is the better architecture; it is not a cost saving. Note also that Path B cannot run on the Workers **Free** plan: the 10 ms CPU cap per invocation rules out PDF receipt generation and the reconciliation cron, and Hyperdrive is capped at 100,000 queries/day there.

---

## 7. Path B — Native Workers, later

Worth doing eventually: no cold start, no per-hour memory billing, and the app runs in every Cloudflare location instead of one. Cloudflare now supports Express directly:

```ts
import { httpServerHandler } from 'cloudflare:node';
import { app } from './app.js';

app.listen(5000);
export default httpServerHandler({ port: 5000 });
```

`server.listen(port)` does not open a TCP socket on Workers — the port becomes an internal identifier the fetch handler routes to. `node:http` server support needs `nodejs_compat` plus a `compatibility_date` of `2025-09-01` or later (`nodejs_compat` is on by default from `2026-08-04`).

That five-line entry point is the easy part. The rest of the migration:

| # | Change | Why | Size |
|---|---|---|---|
| 1 | **Replace Sequelize with Drizzle or raw `pg`, over Hyperdrive** | Sequelize is not a Cloudflare-supported Hyperdrive driver and is reported to hang on Workers | 9 models + 6 repositories + every service. **Weeks.** |
| 2 | Add a Hyperdrive config and binding | Workers have no persistent connection pool; each isolate would open its own Supabase connection | `npx wrangler hyperdrive create pay-db --connection-string="…"`, then read `env.HYPERDRIVE.connectionString`. Use Supabase's **direct** connection string, not the pooler — Hyperdrive does the pooling. |
| 3 | Set pool max to 1 | `DB_POOL_MAX: 10` × thousands of isolates is a connection storm | Small |
| 4 | Move reconciliation to a Cron Trigger | `setInterval` is killed when the request that started it ends | Small |
| 5 | Remove `process.exit` / `SIGTERM` / `process.uptime()` | Not available; `src/config/env.ts` and `src/server.ts` both use them | Small |
| 6 | Replace `express-rate-limit` with the Rate Limiting binding | The memory store is per-isolate and enforces nothing | Small |
| 7 | Replace `swagger-ui-express` | `path.resolve(process.cwd(), 'docs', 'openapi.yaml')` will not resolve; the current `try/catch` swallows the failure and `/docs` silently disappears | Import the YAML as a `Text` module via a wrangler `rules` entry and serve Scalar or Redoc from static HTML |
| 8 | Verify or relocate `pdfkit` | It reads `.afm` font metrics from disk. Workers expose a read-only `/bundle` VFS, so it *may* work — prove it, do not assume | Medium; fall back to generating receipts in a Container or Queue consumer |
| 9 | Read config from bindings, not `process.env` | `env.HYPERDRIVE.connectionString` is not in `process.env`, and `src/config/env.ts` parses at import time | Import `env` from `cloudflare:workers` |

Relevant Workers limits if you go this route: 128 MB memory per isolate, 5 minutes CPU per request on Paid, 64 MiB uncompressed bundle, 1,000 subrequests per invocation on Paid, 6 simultaneous outgoing connections awaiting response headers, 5 KB per secret.

**Do not attempt Path B as a deploy.** It is a rewrite of the persistence layer of a payment service, and it needs its own plan, its own branch and its own test pass.

> **Decision, 2026-09-22: Path A was chosen.** Path B was costed first and set aside —
> it saves about $2/month over the configuration in §6 and costs a multi-week rewrite.
>
> A full implementation plan for Path B exists at
> [`docs/superpowers/plans/2026-09-22-cloudflare-workers-migration.md`](superpowers/plans/2026-09-22-cloudflare-workers-migration.md)
> if it is ever revisited. Its audit found three things this table understates:
>
> - **`pino` and `pino-http` do not work on workerd** — worker threads and transports do not exist there. Add them to the table above.
> - **The existing 165 tests run in Node, not workerd**, so passing them proves nothing about the Worker. Path B needs `@cloudflare/vitest-pool-workers` on top.
> - **Hyperdrive caches reads for 60 s and does not invalidate them on write.** For a payment ledger that is a correctness hazard, so the config must be created with `--caching-disabled` — which also removes most of Path B's latency advantage, since every request then makes a full round trip to Supabase anyway.
>
> Sequelize also leaks much further than the repository layer: 46 model imports across 8 services, 12 controllers, a middleware and a mapper, plus raw `Op` and `sequelize.fn` usage in 4 admin controllers. The blast radius is ~37 files, not 6.

---

## 8. Fallback if Workers Paid is not an option

Run the existing `Dockerfile` on any container host (Fly.io, Railway, Render, a VM) and put Cloudflare in front as DNS + WAF + rate limiting. You keep Cloudflare's edge protections without the Paid plan and without touching application code. This is the cheapest correct answer if $5/month is the blocker; it is not "deployed on Cloudflare" in the compute sense.

---

## Sources

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- [node:http in Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/)
- [node:fs in Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/)
- [Deploy an Express.js application on Workers](https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/)
- [Bringing Node.js HTTP servers to Cloudflare Workers](https://blog.cloudflare.com/bringing-node-js-http-servers-to-cloudflare-workers/)
- [A year of improving Node.js compatibility](https://blog.cloudflare.com/nodejs-workers-2025/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Wrangler bundling](https://developers.cloudflare.com/workers/wrangler/bundling/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) · [get started](https://developers.cloudflare.com/hyperdrive/get-started/) · [Supabase](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/) · [drivers and ORMs](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/)
- [Containers](https://developers.cloudflare.com/containers/) · [get started](https://developers.cloudflare.com/containers/get-started/) · [Container class](https://developers.cloudflare.com/containers/container-package/) · [limits](https://developers.cloudflare.com/containers/platform-details/limits/) · [pricing](https://developers.cloudflare.com/containers/pricing/)
