# Security Architecture & Safeguards

This document outlines the security architecture, authentication protocols, and defense-in-depth measures implemented across the Payment Service.

---

## 1. Authentication & Key Management

### 1.1 Multi-Tenant API Keys
- **Cryptographic Generation**: Keys are created using `crypto.randomBytes(32)` resulting in 256 bits of entropy, prefixed by `pk_live_` or `pk_test_`.
- **Zero Raw Storage**: The plaintext API key is displayed **once** upon creation or rotation and is never stored in the database.
- **Peppered SHA-256 Hashing**: Stored keys are hashed using SHA-256 combined with a secret server-side pepper:
  $$\text{Hash} = \text{SHA-256}(\text{RawKey} \mathbin{\Vert} \text{API\_KEY\_PEPPER})$$
  Even in the event of a database compromise, attacker dictionaries cannot crack API keys without the environment pepper.
- **Timing-Attack Immunity**: Verification utilizes `crypto.timingSafeEqual()` preventing timing attacks.
- **Tenant Scope Enforcement**: Every client request verifies the API key, retrieves the tenant `Application`, and attaches `req.application`. Every database query is strictly scoped to `application_id`.

### 1.2 Admin API Authentication
- Admin operations (creating applications, rotating keys, suspending tenants) are protected by a dedicated `Admin-Api-Key` header verified against `ADMIN_API_KEY` using constant-time string comparison.

---

## 2. Webhook & Signature Security

### 2.1 Incoming Pawapay Webhooks (RFC-9421)
- Pawapay sign callbacks using **RFC-9421 HTTP Message Signatures**.
- **Content-Digest Verification**: Validates the SHA-256 hash of the unparsed raw request body buffer before JSON parsing.
- **Public Key Caching**: Public keys are retrieved from Pawapay's `GET /public-key/http` and cached with TTL in-memory.
- **Configurable Toggle**: Can be enabled or disabled via `PAWAPAY_VERIFY_CALLBACK_SIGNATURES`.

### 2.2 Outgoing SaaS Notifications (HMAC-SHA256)
- Notifications sent to SaaS applications are signed using HMAC-SHA256 with the tenant's unique `webhook_secret`.
- Header format: `X-Payment-Signature: t=<timestamp>,v1=<signature>`
- Timestamp tolerance prevents replay attacks (default 300s window).

---

## 3. Defense Against Replay & Concurrency Attacks

- **Idempotency Keys**: Required for all `POST /api/v1/payments` requests.
- **Database Unique Constraint**: Unique index `(application_id, key)` on `idempotency_keys` table guarantees race-condition safety.
- **In-Flight Locking**: While a payment is being orchestrated with Pawapay, subsequent concurrent requests with the same key receive `409 Conflict`.
- **Payload Tampering Defense**: The request payload is hashed into `request_hash`. Re-using an idempotency key with different parameters is immediately rejected.

---

## 4. Rate Limiting & DoS Protection

Three distinct rate-limiting tiers are applied using `express-rate-limit`:
1. **Public Limiter**: `60 req/min` for unauthenticated endpoints.
2. **Authenticated Limiter**: `600 req/min` per authenticated tenant application (`application.id`).
3. **Webhook Limiter**: `300 req/min` for provider webhook ingestion.

---

## 5. Input Validation & SQL Injection Prevention

- **Zod Schema Validation**: Strict input boundary validation across bodies, headers, and query parameters.
- **Parameterized SQL**: All database queries are executed through Sequelize ORM using parameterized queries with zero raw string concatenation.
- **Payload Limits**: `express.json({ limit: '100kb' })` prevents memory exhaustion attacks.

---

## 6. Sensitive Data Redaction & Logging

- **Pino Structured Logger**: Configured with automatic redaction paths:
  - `req.headers.authorization`
  - `Admin-Api-Key`
  - `payer.accountDetails.phoneNumber`
  - `apiKeyHash`
  - `password`, `token`
- Masked as `[REDACTED]` before reaching console or log streams.
