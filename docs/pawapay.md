# Pawapay Integration & Going Live Guide

## 1. Overview

The Payment Service integrates directly with Pawapay's **V2 API** (`https://docs.pawapay.io` / `https://pawapay.mintlify.app`) to provide mobile-money deposit, payout, refund, and hosted checkout orchestration across Sub-Saharan Africa (primary market: Tanzania).

### Environment URLs

| Environment | API Base URL | Dashboard URL |
| :--- | :--- | :--- |
| **Production (Live)** | `https://api.pawapay.io` | `https://dashboard.pawapay.io` |
| **Sandbox (Testing)** | `https://api.sandbox.pawapay.io` | `https://dashboard.sandbox.pawapay.io` |

---

## 2. API Endpoints Used

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/v2/deposits` | `POST` | Initiate mobile money deposit (STK push / USSD prompt) |
| `/v2/deposits/{depositId}` | `GET` | Fetch real-time deposit status |
| `/v2/payouts` | `POST` | Initiate mobile money disbursement / payout |
| `/v2/payouts/{payoutId}` | `GET` | Fetch real-time payout status |
| `/v2/refunds` | `POST` | Initiate refund on an existing completed deposit |
| `/v2/refunds/{refundId}` | `GET` | Fetch real-time refund status |
| `/v2/checkouts` | `POST` | Create hosted checkout session |
| `/v2/checkouts/{checkoutId}` | `GET` | Fetch hosted checkout session status |
| `/v2/predict-provider` | `POST` | Auto-detect telco provider from phone number |
| `/public-key/http` | `GET` | Fetch Pawapay ECDSA public key (`HTTP_EC_P256_KEY`) for RFC-9421 signature verification |

---

## 3. Formatting Rules

### 3.1 Phone Numbers
- **Client API**: Accepts international **E.164** format (e.g., `+255754123456`).
- **Pawapay Transmission**: Automatically normalized to **MSISDN** (digits only, country code included, no leading `+`, e.g., `255754123456`).

### 3.2 Supported Country & Currency
- **Country**: Tanzania (`TZ` $\rightarrow$ `TZA`). Note: The root `country` field is omitted from Pawapay V2 `/v2/deposits` payload as enforced by Pawapay V2 specifications.
- **Currency**: `TZS` (Tanzanian Shilling).

### 3.3 Supported Mobile Money Providers (Tanzania)
| Operator | Internal / Client Code | Aliases | Pawapay V2 Code |
| :--- | :--- | :--- | :--- |
| **Vodacom Tanzania (M-Pesa)** | `VODACOM_TZA` | `VODACOM`, `MPESA` | `VODACOM_TZA` |
| **Airtel Tanzania (Airtel Money)** | `AIRTEL_TZA` | `AIRTEL` | `AIRTEL_TZA` |
| **Yas Tanzania (formerly Tigo)** | `YAS_TZA` | `YAS`, `TIGO_TZA`, `TIGO` | `TIGO_TZA` |
| **Halotel Tanzania (HaloPesa)** | `HALOTEL_TZA` | `HALOTEL` | `HALOTEL_TZA` |

### 3.4 Amount Format
- Stored internally as integer or `DECIMAL(18,2)`.
- Enforces **0 decimal places** for `TZS` (e.g., `"45000"` instead of `"45000.00"`) to comply with Pawapay's strict zero-decimal rule for Tanzanian Shilling.

### 3.5 Idempotency & Unique Identifiers
- UUIDv4 generated per request (`depositId`, `payoutId`, `refundId`, `checkoutId`).
- Acts as Pawapay's idempotency key. Duplicate requests receive `DUPLICATE_IGNORED`.

---

## 4. Automatic Provider Detection

If a SaaS application does not provide the `provider` field, the service queries Pawapay's `/v2/predict-provider` endpoint with the phone number to automatically determine the operator (`VODACOM_TZA`, `AIRTEL_TZA`, `TIGO_TZA`, or `HALOTEL_TZA`).

---

## 5. Webhook Signature Verification (RFC-9421)

Pawapay delivers webhook updates using RFC-9421 HTTP Message Signatures:
- **Headers**: `Signature`, `Signature-Input`, `Content-Digest`.
- **Algorithm**: `ecdsa-p256-sha256` (DER-encoded signature bytes).
- **Public Key**: Cached dynamically from `GET /public-key/http` with a 1-hour TTL.
- **Configuration**: Set `PAWAPAY_VERIFY_CALLBACK_SIGNATURES=true`.

---

## 6. Going Live Checklist

When transitioning from Sandbox to Production:

1. **Dashboard Account**: Log into the production dashboard at [https://dashboard.pawapay.io](https://dashboard.pawapay.io).
2. **Generate Production API Token**: Create a new API token in the Production Dashboard (sandbox tokens will not authenticate on `https://api.pawapay.io`).
3. **Configure Callback URLs in Dashboard**:
   - Webhook callback endpoint: `https://pay-api.reignovatechnologies.com/api/v1/webhooks/pawapay`
   - (Or individual endpoints: `/pawapay/payouts`, `/pawapay/refunds`, `/pawapay/checkouts`).
4. **Enable Signed Callbacks**: In Dashboard -> Settings -> Webhooks, enable cryptographic signatures.
5. **Update Backend Environment Variables**:
   - `PAWAPAY_BASE_URL=https://api.pawapay.io`
   - `PAWAPAY_API_TOKEN=<YOUR_PRODUCTION_TOKEN>`
   - `PAWAPAY_VERIFY_CALLBACK_SIGNATURES=true`
   - Ensure `CORS_ORIGIN` is set to the frontend origin (e.g. `https://pay.reignovatechnologies.com`), NOT `api.pawapay.io`.
6. **Firewall / IP Whitelisting**: If using Cloudflare WAF, bypass bot/challenge rules for incoming Pawapay production webhook IPs:
   - `18.192.208.15`
   - `18.195.113.136`
   - `3.72.212.107`
   - `54.73.125.42`
   - `54.155.38.214`
   - `54.73.130.113`
7. **Test with Real Wallets**: Unlike sandbox test phone numbers, production transactions debit and credit real mobile wallets with actual TZS. Start with a minimal amount (e.g. 500 or 1,000 TZS) to verify end-to-end receipt of USSD prompt and webhook callback settlement.
