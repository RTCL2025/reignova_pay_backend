# Pawapay Integration Guide

## 1. Overview

The Payment Service integrates directly with Pawapay's **V2 API** to provide mobile-money deposit capabilities across Sub-Saharan Africa.

- **Sandbox API URL**: `https://api.sandbox.pawapay.cloud`
- **Production API URL**: `https://api.pawapay.cloud`

---

## 2. API Endpoints Used

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/v2/deposits` | `POST` | Initiate mobile money deposit request |
| `/v2/deposits/{depositId}` | `GET` | Fetch real-time deposit status |
| `/v2/predict-provider` | `POST` | Auto-detect telco provider from phone number |
| `/public-key/http` | `GET` | Fetch Pawapay public key for RFC-9421 signature verification |

---

## 3. Formatting Rules

### 3.1 Phone Numbers
- **Client API**: Accepts international **E.164** format (e.g., `+255700000000`).
- **Pawapay Transmission**: Automatically normalized to **MSISDN** (digits only, country code included, no leading `+`, e.g., `255700000000`).

### 3.2 Country Codes
- **Client API**: Accepts ISO 3166-1 alpha-2 (e.g., `TZ`, `ZM`, `KE`).
- **Pawapay Transmission**: Automatically mapped to ISO 3166-1 alpha-3:
  - `TZ` $\rightarrow$ `TZA` (Tanzania)
  - `ZM` $\rightarrow$ `ZMB` (Zambia)
  - `RW` $\rightarrow$ `RWA` (Rwanda)
  - `UG` $\rightarrow$ `UGA` (Uganda)
  - `KE` $\rightarrow$ `KEN` (Kenya)
  - `GH` $\rightarrow$ `GHA` (Ghana)
  - `NG` $\rightarrow$ `NGA` (Nigeria)

### 3.3 Amount Format
- Stored internally as `DECIMAL(18,2)`.
- Sent to Pawapay V2 as fixed string representation (e.g. `"45000.00"`).

### 3.4 Deposit ID
- A client-generated UUIDv4 is sent as Pawapay's `depositId`.
- Acts as Pawapay's own idempotency key. If Pawapay receives the same `depositId` again, it responds with `DUPLICATE_IGNORED`.

---

## 4. Automatic Provider Detection

If a SaaS application does not provide the `provider` field, the service queries Pawapay's `/v2/predict-provider` endpoint with the phone number to determine the mobile money network (e.g., `VODACOM_MOMO_TZA`, `MTN_MOMO_ZMB`, `AIRTEL_OAPI_KEN`).

---

## 5. Webhook Signature Verification

Pawapay delivers webhook updates using RFC-9421 HTTP Message Signatures.
- Headers: `Signature`, `Signature-Input`, `Content-Digest`.
- Enabled via `PAWAPAY_VERIFY_CALLBACK_SIGNATURES=true`.
- The public key is cached with a 1-hour TTL.
