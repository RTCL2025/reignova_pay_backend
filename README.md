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
- **Database**: PostgreSQL 16
- **ORM**: Sequelize v6
- **Migrations**: Umzug
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
- **Database**: PostgreSQL 14+ or Docker

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

### 3. Setup Database, Run Migrations & Seed Demo Application
```bash
# Create database (if not already created)
pnpm db:create

# Run migrations
pnpm db:migrate

# Seed demo tenant ("ReignovaEvents") and display API key
pnpm db:seed

# Optional: To drop or completely reset the database
pnpm db:drop   # Drops payment_service database
pnpm db:reset  # Drops, creates, migrates, and seeds in one command
```

### 4. Start Development Server
```bash
pnpm dev
```
The server will start on `http://localhost:5000`.

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

To launch the payment service and PostgreSQL using Docker Compose:

```bash
docker compose up -d
```

To run database migrations and seed the demo application inside the container:
```bash
# Run migrations
docker compose exec payment-service node dist/database/migrate.js up

# (Optional) Seed demo tenant (ReignovaEvents)
docker compose exec payment-service node dist/database/seed.js
```

> **Note**: The containerized PostgreSQL database is accessible from the host machine on port `5435` (e.g., `postgresql://postgres:postgres@localhost:5435/payment_service`) to avoid port conflicts with local PostgreSQL instances. Inside the Docker network, services communicate on standard port `5432`.

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
