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
- **Client API**: Accepts international **E.164** format for Tanzania (e.g., `+255754123456`).
- **Pawapay Transmission**: Automatically normalized to **MSISDN** (digits only, country code included, no leading `+`, e.g., `255754123456`).

### 3.2 Supported Country & Currency
- **Country**: Tanzania only (`TZ` $\rightarrow$ `TZA`). Note: The root `country` field is omitted from Pawapay V2 `/v2/deposits` payload as enforced by Pawapay V2 specifications.
- **Currency**: `TZS` (Tanzanian Shilling).

### 3.3 Supported Mobile Money Providers
The service exclusively supports the 3 major Tanzanian mobile network operators:

| Operator | Internal / Client Code | Aliases | Pawapay V2 Code |
| :--- | :--- | :--- | :--- |
| **Vodacom Tanzania (M-Pesa)** | `VODACOM_TZA` | `VODACOM`, `MPESA` | `VODACOM_TZA` |
| **Airtel Tanzania (Airtel Money)** | `AIRTEL_TZA` | `AIRTEL` | `AIRTEL_TZA` |
| **Yas Tanzania (formerly Tigo)** | `YAS_TZA` | `YAS`, `TIGO_TZA`, `TIGO` | `TIGO_TZA` |

### 3.4 Amount Format
- Stored internally as integer or `DECIMAL(18,2)`.
- Enforces **0 decimal places** for `TZS` (e.g., `"45000"` instead of `"45000.00"`) to comply with Pawapay's strict zero-decimal rule for Tanzanian Shilling.

### 3.5 Deposit ID
- A client-generated UUIDv4 is sent as Pawapay's `depositId`.
- Acts as Pawapay's own idempotency key. If Pawapay receives the same `depositId` again, it responds with `DUPLICATE_IGNORED`.

---

## 4. Automatic Provider Detection

If a SaaS application does not provide the `provider` field, the service queries Pawapay's `/v2/predict-provider` endpoint with the phone number to automatically determine the operator (`VODACOM_TZA`, `AIRTEL_TZA`, or `TIGO_TZA`). If `YAS_TZA` or `YAS` is supplied by the client, the service automatically translates it to `TIGO_TZA` for Pawapay compatibility.

---

## 5. Webhook Signature Verification

Pawapay delivers webhook updates using RFC-9421 HTTP Message Signatures.
- Headers: `Signature`, `Signature-Input`, `Content-Digest`.
- Enabled via `PAWAPAY_VERIFY_CALLBACK_SIGNATURES=true`.
- The public key is cached with a 1-hour TTL.
