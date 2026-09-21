# Reusable SaaS Payment Microservice

A production-grade, multi-tenant mobile-money payment microservice integrating with **Pawapay**. Built to serve as a standalone payment orchestration platform for multiple SaaS applications (such as **ReignovaEvents** and future products) with zero vendor lock-in and strict tenant isolation.

---

## Features

- **Multi-Tenant Architecture**: Isolate multiple SaaS products with independent API keys, webhooks, and rate limits.
- **Tanzania Mobile Money Orchestration**: Purpose-built for Tanzania, supporting **Vodacom** (`VODACOM_TZA`), **Airtel** (`AIRTEL_TZA`), and **Yas** (formerly Tigo, `YAS_TZA` / `TIGO_TZA`) in **TZS**.
- **Automatic Provider Detection**: Predicts mobile money operators via `/v2/predict-provider` or accepts explicit provider codes.
- **Strict Idempotency**: Header-based `Idempotency-Key` with database locks and canonical payload hashing.
- **Payment State Machine**: Deterministic lifecycle states (`PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `COMPLETED` / `FAILED`).
- **Webhook Ingestion**: Fast-acknowledgement webhook receiver with RFC-9421 signature verification and duplicate suppression.
- **Asynchronous Notifications**: Outgoing webhook dispatching with HMAC-SHA256 signatures and exponential backoff retry (1m, 5m, 15m, 30m, 1h).
- **Security & Privacy**: Hashed API keys with pepper, constant-time comparisons, rate limiting, and sensitive data redaction in logs.
- **Interactive Documentation**: OpenAPI 3.0 specification served via Swagger UI at `/docs`.

---

## Tech Stack

- **Runtime**: Node.js (>=20.0.0, ESM)
- **Language**: TypeScript (Strict mode)
- **HTTP Framework**: Express.js
- **Database**: PostgreSQL 16 (Supabase in development/production, local Docker for tests)
- **ORM**: Sequelize v6
- **Migrations**: sequelize-cli
- **Validation**: Zod
- **Logging**: Pino with sensitive field redaction
- **Testing**: Vitest, Supertest

---

## Architecture Overview

```mermaid
flowchart LR
    SaaS[SaaS Client\ne.g. ReignovaEvents] -->|REST API\nBearer pk_live_...| Gateway[Payment Service]
    Admin[Platform Admin] -->|Admin-Api-Key| Gateway
    Gateway <--> DB[(PostgreSQL 16)]
    Gateway -->|Initiate Deposit| Pawapay[Pawapay V2]
    Pawapay -->|Webhook Callback| Gateway
    Gateway -->|Signed Webhook\nHMAC-SHA256| SaaS
```

---

## Prerequisites

- **Node.js**: >= 20.0.0
- **Package Manager**: `pnpm` (>= 11.0.0)
- **Database**: A [Supabase](https://supabase.com) project for development, and Docker for the local test database

---

## Quick Start (Local Development)

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd payment-service
pnpm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Set Up the Database
See [Database](#database) below for the full Supabase setup. Once `DATABASE_URL` is
configured in `.env`, apply the schema and seed the initial admin user:
```bash
pnpm db:migrate
pnpm db:seed
```
This creates a single `SUPER_ADMIN` row in `admin_users` (email taken from the seeder)
and prints nothing else — there is no demo tenant seeder. To obtain a client API key,
start the server and register an application through the admin API (authenticated with
`ADMIN_API_KEY` from `.env`); the registration response contains the new application's
API key.

### 4. Start Development Server
```bash
pnpm dev:nodemon
```
The server will start on `http://localhost:5000`.

---

## Database

The service runs on **Supabase PostgreSQL** in development and production, and on a
local Docker PostgreSQL for the automated test suite. All schema and seed data are
managed by `sequelize-cli`. The `@supabase/supabase-js` client is not used — the
service connects over the plain PostgreSQL wire protocol.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → Database → Connection string** and select the
   **Session pooler** tab. Use that string, not the direct connection: direct
   connections to `db.<ref>.supabase.co` are IPv6-only and fail on most networks
   and CI runners without the paid IPv4 add-on.
3. Copy it into `DATABASE_URL` in your `.env`, and set `DB_SSL=true`.

The username must be in the form `postgres.<project-ref>`, and reserved characters
in the password must be percent-encoded (`@` → `%40`, `#` → `%23`, and so on).

```
DATABASE_URL=postgresql://postgres.abcdefgh:s3cr%40t@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
DB_SSL=true
```

Then apply the schema:

```bash
pnpm db:migrate
pnpm db:seed
```

### Scripts

| Script | What it does |
| --- | --- |
| `pnpm db:migrate` | Apply all pending migrations |
| `pnpm db:migrate:undo` | Revert the most recent migration |
| `pnpm db:migrate:undo:all` | Revert every migration |
| `pnpm db:migrate:status` | Show which migrations are applied |
| `pnpm db:seed` | Run all pending seeders |
| `pnpm db:seed:undo` | Revert all seeders |
| `pnpm db:reset` | Revert seeders, then migrations, then re-migrate and re-seed. Refuses to run unless the resolved database host is `localhost`, `127.0.0.1` or `::1` (override with `DB_RESET_ALLOW_REMOTE=1`) |
| `pnpm migration:create <name>` | Scaffold a new migration (`.cjs`) |
| `pnpm seed:create <name>` | Scaffold a new seeder (`.cjs`) |

There is no `db:create` or `db:drop`. Supabase grants no superuser, so
`CREATE DATABASE` and `DROP DATABASE` are not available; `db:reset` rebuilds the
schema in place instead.

**`db:migrate:undo:all` does not clear seeder state.** sequelize-cli tracks which
seeders have run in the `SequelizeData` table, which is not touched by migrations.
After running `pnpm db:migrate:undo:all` by hand, a plain `pnpm db:seed` will report
`No seeders found` and leave `admin_users` empty, because sequelize-cli still believes
the seeder already ran. Run `pnpm db:seed:undo` first if you need to re-seed manually —
or just use `pnpm db:reset`, which already does this in the right order.

New migrations and seeders must be written as **CommonJS `.cjs` files**. This package
is ESM (`"type": "module"`), and sequelize-cli loads these files with `require()`, so a
`.js` file would fail with `ERR_REQUIRE_ESM`. When a migration creates an `ENUM` column,
its `down` must also `DROP TYPE IF EXISTS "enum_<table>_<column>"` — `dropTable` leaves
the type behind, which breaks `db:reset` on the second run.

### Running the tests

The test suite uses local Docker PostgreSQL, not Supabase:

```bash
docker compose up -d postgres
NODE_ENV=test pnpm db:migrate
pnpm test
```

### Troubleshooting

| Error | Cause |
| --- | --- |
| `SELF_SIGNED_CERT_IN_CHAIN`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | The app (`src/config/database.ts`) honours `DB_SSL`; sequelize-cli's `development` block does too, and its `production` block always forces SSL. If you are pointed at Supabase, make sure `DB_SSL=true` is actually set — Supabase uses its own CA, which Node does not trust by default |
| `password authentication failed` | The password contains reserved characters that were not percent-encoded, or the username omits the `postgres.<project-ref>` form the pooler requires |
| `ENETUNREACH` on connect | You are using the direct connection string. Switch to the session pooler |
| `type "enum_..." already exists` | A migration's `down` is missing its `DROP TYPE IF EXISTS` |

---

## Testing

```bash
# Run all tests (Unit, Integration, E2E)
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests
pnpm test:integration

# Run end-to-end tests
pnpm test:e2e
```

---

## Docker Deployment

`docker-compose.yml` only provisions the local PostgreSQL used by the automated test
suite (see [Database](#database)); it no longer runs the application, since the app
now targets Supabase rather than a containerized database.

To run the containerized application itself, build and run `Dockerfile` directly,
configured entirely through environment variables (see `.env.example`):

```bash
docker build -t payment-service .
docker run -p 5000:5000 --env-file .env payment-service
```

Apply migrations and seed data against Supabase first, as described in
[Database](#database).

---

## SaaS Client Integration Example (ReignovaEvents)

### 1. Initiate Deposit
```bash
curl -X POST http://localhost:5000/api/v1/payments \
  -H "Authorization: Bearer <YOUR_API_KEY>" \
  -H "Idempotency-Key: evt-order-99120" \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "EVT-TICKET-99120",
    "amount": 50000,
    "currency": "TZS",
    "phoneNumber": "+255754123456",
    "country": "TZ",
    "provider": "VODACOM_TZA",
    "description": "VIP Pass 2026",
    "metadata": {
      "ticketType": "VIP",
      "userId": "usr_abc123"
    }
  }'
```

### 2. Verify Incoming Webhook Notification
The payment service sends an HMAC-signed POST request to your registered webhook URL:
- Header: `X-Payment-Signature: t=<timestamp>,v1=<signature>`
- Payload:
```json
{
  "event": "payment.completed",
  "timestamp": "2026-09-17T18:00:45.000Z",
  "data": {
    "paymentId": "...",
    "reference": "EVT-TICKET-99120",
    "amount": 50000.00,
    "currency": "TZS",
    "status": "COMPLETED",
    "completedAt": "2026-09-17T18:00:45.000Z"
  }
}
```

Verify the signature using your `webhookSecret`:
```typescript
import crypto from 'node:crypto';

function verifySignature(payload: string, secret: string, header: string): boolean {
  const [tPart, v1Part] = header.split(',');
  const timestamp = tPart.split('=')[1];
  const signature = v1Part.split('=')[1];

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

---

## API Documentation

Access the interactive Swagger UI documentation at:
```
http://localhost:5000/docs
```

Detailed documentation:
- [System Architecture](docs/architecture.md)
- [API Reference](docs/api.md)
- [Security Architecture](docs/security.md)
- [Payment Lifecycle](docs/payment-lifecycle.md)
- [Pawapay Integration](docs/pawapay.md)

---

## License

ISC
