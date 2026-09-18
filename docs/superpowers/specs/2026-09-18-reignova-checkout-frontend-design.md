# Reignova Checkout Frontend & Backend Integration Specification

## 1. Overview & Business Objectives
Reignova Technologies requires a production-ready, highly secure, branded hosted checkout solution integrated into the existing `payment-service` repository. The checkout experience serves Reignova's flagship and partner platforms (such as ReignovaEvents) while providing a white-label capable, multi-tenant architecture for future merchants and platforms across East Africa.

The checkout supports mobile money payments (Vodacom M-Pesa, Tigo Pesa, Airtel Money, and Halotel in Tanzania) orchestrated securely through the backend's existing Pawapay payment gateway without exposing private API credentials, database keys, or internal payment provider mechanisms to the browser.

---

## 2. System Architecture & Repository Structure

### 2.1 Directory Structure
The repository adopts a unified single-repository structure (Option 1):
```
payment-service/
├── src/                                  # Existing Express.js backend
│   ├── config/                           # Environment & database configs
│   ├── controllers/                      # Route controllers
│   ├── database/migrations/              # Umzug / Sequelize migrations
│   ├── integrations/pawapay/             # Pawapay gateway implementation
│   ├── middleware/                       # Auth, validation, rate limiting
│   ├── models/                           # Sequelize models
│   ├── repositories/                     # Data access layer
│   ├── routes/                           # API route definitions
│   ├── schemas/                          # Zod request validation schemas
│   ├── services/                         # Business & orchestration logic
│   └── utils/                            # Shared error classes and helpers
├── frontend/                             # Next.js 14+ Checkout Application
│   ├── app/
│   │   ├── checkout/
│   │   │   └── [publicToken]/
│   │   │       └── page.tsx              # Main hosted checkout page
│   │   ├── globals.css                   # Tailwind CSS + Reignova design tokens
│   │   └── layout.tsx                    # HTML shell, fonts, meta tags
│   ├── components/
│   │   ├── checkout/
│   │   │   ├── CheckoutHeader.tsx        # Brand mark, SSL indicator, merchant name
│   │   │   ├── CheckoutLayout.tsx        # Responsive dual-card layout container
│   │   │   ├── CustomerDetailsForm.tsx   # React Hook Form customer inputs
│   │   │   ├── MerchantSummary.tsx       # Merchant branding, order reference
│   │   │   ├── PaymentMethodSelector.tsx # Mobile money operator selector
│   │   │   ├── PaymentSummary.tsx        # High-contrast amount, currency & timer
│   │   │   └── states/
│   │   │       ├── CheckoutCancelled.tsx # Cancellation state
│   │   │       ├── CheckoutExpired.tsx   # Expired checkout notification
│   │   │       ├── CheckoutFailed.tsx    # Failure message & retry actions
│   │   │       ├── CheckoutProcessing.tsx# Mobile money prompt instructions
│   │   │       ├── CheckoutSkeleton.tsx  # Zero-layout-shift shimmer loader
│   │   │       └── CheckoutSuccess.tsx   # Payment verified, return to merchant
│   │   └── ui/                           # Primitives (buttons, inputs, cards)
│   ├── hooks/
│   │   └── use-checkout-status.ts        # Polling hook with backoff & cleanup
│   ├── lib/
│   │   ├── api-client.ts                 # Type-safe HTTP client
│   │   ├── checkout-api.ts               # Checkout backend endpoints
│   │   ├── formatters.ts                 # Currency & telephone formatters
│   │   └── validation.ts                 # Zod validation schema for forms
│   ├── types/
│   │   └── checkout.ts                   # Frontend TypeScript interfaces
│   ├── package.json                      # Frontend dependencies
│   ├── tailwind.config.js                # Reignova color & font extensions
│   └── tsconfig.json                     # Next.js TypeScript config
├── docs/                                 # Documentation & OpenAPI specs
├── tests/                                # Backend unit, integration & E2E tests
├── package.json                          # Root package.json with unified scripts
└── README.md                             # Top-level setup & deployment documentation
```

---

## 3. Database Schema & Migration

### 3.1 Migration `010-add-public-token-to-checkouts.ts`
Applies non-destructive column additions to the `checkouts` table:
- `public_token`: `DataTypes.STRING(80)`, `allowNull: true`, `unique: true`.
- `cancel_url`: `DataTypes.TEXT`, `allowNull: true`.
- `customer_name`: `DataTypes.STRING(100)`, `allowNull: true`.
- `customer_email`: `DataTypes.STRING(255)`, `allowNull: true`.
- `customer_phone`: `DataTypes.STRING(50)`, `allowNull: true`.
- Index: `checkouts_public_token_unique` on `public_token`.

### 3.2 Token Generation & Cryptographic Security
- Public tokens are generated using cryptographically secure random bytes:
  `cs_sec_` + `crypto.randomBytes(24).toString('hex')`.
- This ensures 192 bits of entropy, rendering tokens completely unguessable.
- Internal database UUIDs and tenant IDs are never exposed in checkout URLs.

---

## 4. API Endpoints & Request Flow

### 4.1 Merchant Endpoint: Create Checkout Session
- **Route**: `POST /api/v1/checkouts`
- **Auth**: `Authorization: Bearer <API_KEY>` or `Admin-Api-Key: <ADMIN_KEY>`
- **Headers**: `Idempotency-Key: <UUID_OR_STRING>`
- **Request Body (Simplified or Multi-Amount)**:
  ```json
  {
    "reference": "EVENT-ORDER-1001",
    "amount": 25000,
    "currency": "TZS",
    "country": "TZA",
    "description": "Event registration payment",
    "customer": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+255754123456"
    },
    "successUrl": "https://reignovaevents.com/orders/EVENT-ORDER-1001/success",
    "cancelUrl": "https://reignovaevents.com/orders/EVENT-ORDER-1001/cancel",
    "expiresAfter": 30,
    "metadata": { "orderId": "ORDER-1001" }
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "7ca893b1-8e9a-4c4f-9e1a-3d2e1b4c5d6e",
      "publicToken": "cs_sec_a8f9c102938475610293847561029384",
      "checkoutUrl": "https://pay.reignovatechnologies.com/checkout/cs_sec_a8f9c102938475610293847561029384",
      "reference": "EVENT-ORDER-1001",
      "status": "PENDING",
      "amount": 25000,
      "currency": "TZS",
      "expiresAt": "2026-09-18T16:45:00.000Z",
      "createdAt": "2026-09-18T16:15:00.000Z"
    }
  }
  ```

### 4.2 Public Checkout Endpoints (`/api/v1/checkouts/public/*`)
Protected by `publicRateLimiter` (default 60 requests/minute per IP) and strict CORS.

#### A. Retrieve Session Details
- **Route**: `GET /api/v1/checkouts/public/:publicToken`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "publicToken": "cs_sec_a8f9c102938475610293847561029384",
      "reference": "EVENT-ORDER-1001",
      "amount": 25000,
      "currency": "TZS",
      "country": "TZA",
      "description": "Event registration payment",
      "merchant": {
        "name": "ReignovaEvents",
        "slug": "reignova-events",
        "logoUrl": null
      },
      "customer": {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+255754123456"
      },
      "status": "PENDING",
      "expiresAt": "2026-09-18T16:45:00.000Z",
      "successUrl": "https://reignovaevents.com/orders/EVENT-ORDER-1001/success",
      "cancelUrl": "https://reignovaevents.com/orders/EVENT-ORDER-1001/cancel",
      "supportedProviders": [
        { "id": "VODACOM_TZA", "name": "Vodacom M-Pesa", "brandColor": "#E60000" },
        { "id": "TIGO_TZA", "name": "Tigo Pesa", "brandColor": "#00377B" },
        { "id": "AIRTEL_TZA", "name": "Airtel Money", "brandColor": "#ED1C24" },
        { "id": "HALOTEL_TZA", "name": "Halotel", "brandColor": "#F68B1F" }
      ]
    }
  }
  ```

#### B. Initiate Payment
- **Route**: `POST /api/v1/checkouts/public/:publicToken/pay`
- **Request Body**:
  ```json
  {
    "phoneNumber": "255754123456",
    "provider": "VODACOM_TZA",
    "customerName": "John Doe",
    "customerEmail": "john@example.com"
  }
  ```
- **Validation**:
  - Validates session status is `PENDING` or `WAITING_PAYMENT`.
  - Verifies session is not expired.
  - Validates phone number via `libphonenumber-js`.
  - Validates mobile money provider against supported list.
- **Processing**:
  - Calls `paymentService.createDeposit` using the verified stored amount & currency (never trusting client input).
  - Associates `depositId` with the `Checkout` record.
  - Updates checkout status to `PROCESSING`.
- **Response (`202 Accepted`)**:
  ```json
  {
    "success": true,
    "data": {
      "status": "PROCESSING",
      "depositId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "message": "Payment prompt sent to mobile device. Please complete PIN verification on your phone."
    }
  }
  ```

#### C. Poll Status
- **Route**: `GET /api/v1/checkouts/public/:publicToken/status`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "status": "COMPLETED",
      "depositStatus": "COMPLETED",
      "depositId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "completedAt": "2026-09-18T16:16:12.000Z",
      "failureReason": null,
      "returnUrl": "https://reignovaevents.com/orders/EVENT-ORDER-1001/success"
    }
  }
  ```

#### D. Cancel Session
- **Route**: `POST /api/v1/checkouts/public/:publicToken/cancel`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "status": "CANCELLED",
      "cancelUrl": "https://reignovaevents.com/orders/EVENT-ORDER-1001/cancel"
    }
  }
  ```

---

## 5. Webhook Integration & State Machine

When Pawapay posts a callback to `/api/v1/webhooks/pawapay` or `/api/v1/webhooks/pawapay/checkouts`:
1. Signature is verified if enabled (`pawapaySignatureVerifier`).
2. Webhook idempotency check ensures duplicate events are handled safely.
3. The deposit status is transitioned to `COMPLETED` or `FAILED`.
4. `webhookService` queries the `checkouts` table for any session matching the `depositId`.
5. If found, `checkoutService.transitionCheckoutStatus` is invoked within the database transaction, updating the checkout status to `COMPLETED` or `FAILED` with timestamp and audit logs.
6. The frontend's polling hook detects the state change within 2-3 seconds, automatically displaying the confirmed success or failure view.

---

## 6. Reignova Visual Identity & UI Design

### 6.1 Theme Tokens & Colors
- **Primary Navy**: `#0F1A25` (main background & prominent badges)
- **Secondary Navy**: `#16212F` (card surface & elevated containers)
- **Border Navy**: `#1E2C3B` (dividers on dark backgrounds)
- **Reignova Amber/Orange**: `#F3A221` (primary action buttons, highlights, badges)
- **Orange Hover**: `#FFB74D`
- **Warm Cream**: `#F7F5F0` (subtle page background)
- **Slate Text**: `#5B6472` (body text & labels)
- **Typography**:
  - Headings & Interface: `Montserrat`, sans-serif
  - Numbers, Amounts, & Tokens: `IBM Plex Mono`, monospace

### 6.2 Visual Elements
- **Circuit Trace Motif**: Subtle gradient line with glow node accentuating the checkout header and state transitions.
- **Fintech Security Indicators**: End-to-end 256-bit encryption indicator, provider compliance badges.
- **Responsive Layout**:
  - Desktop: Centered card container with high contrast, split payment summary on left/top and customer form on right/bottom.
  - Mobile: Full-width touch-friendly interface with sticky summary and large touch targets (min 48px).

---

## 7. Security, Resiliency & Defenses

1. **Information Leakage Prevention**:
   - Internal DB UUIDs, merchant API keys, webhook secrets, and provider credentials are completely omitted from public responses.
2. **Amount Tampering Defense**:
   - The payment amount and currency are read strictly from the immutable checkout record in PostgreSQL, never from client request bodies.
3. **Open Redirect Protection**:
   - `successUrl` and `cancelUrl` are validated as valid URLs upon checkout creation and cannot be modified by the frontend.
4. **Duplicate Submission Prevention**:
   - The submit button is immediately disabled and enters a loading state upon initial click.
   - The backend rejects `/pay` if the checkout is already in `PROCESSING` or `COMPLETED` status.
5. **Session Expiry**:
   - Checkouts default to 30 minutes expiration (configurable 3–60 min).
   - Once expired, payments cannot be initiated.
6. **Rate Limiting**:
   - Express `publicRateLimiter` restricts public API calls per IP to prevent scraping and denial of service.

---

## 8. Deployment Architecture (`pay.reignovatechnologies.com`)

### 8.1 Unified Domain Routing
Both frontend and backend are unified behind `https://pay.reignovatechnologies.com`:
- `/checkout/*` ➔ Next.js (port 3000)
- `/api/v1/*` ➔ Express API (port 5000)
- `/health` ➔ Express API (port 5000)
- `/docs` ➔ Express Swagger UI (port 5000)

### 8.2 Environment Configuration
- **Backend (`.env`)**:
  ```env
  CHECKOUT_BASE_URL=http://localhost:3000
  CORS_ORIGIN=http://localhost:3000,https://pay.reignovatechnologies.com
  ```
- **Frontend (`frontend/.env.local`)**:
  ```env
  NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

---

## 9. Verification & Testing Plan

### 9.1 Backend Integration Tests (`tests/integration/public-checkout.test.ts`)
- `POST /api/v1/checkouts` creates session and generates `publicToken` + `checkoutUrl`.
- `GET /api/v1/checkouts/public/:publicToken` retrieves sanitized session without auth.
- Invalid token returns `404 Not Found`.
- Expired session returns `EXPIRED` status.
- `POST /api/v1/checkouts/public/:publicToken/pay` initiates Pawapay deposit.
- Validation rejects invalid phone numbers or unsupported providers.
- Rejects duplicate payment initiation on `PROCESSING` or `COMPLETED` sessions.
- Pawapay webhook updates linked checkout status to `COMPLETED`.
- `GET /api/v1/checkouts/public/:publicToken/status` reflects `COMPLETED`.
- `POST /api/v1/checkouts/public/:publicToken/cancel` cancels pending checkout.
- All existing 116 tests continue to pass with 0 regressions.

### 9.2 Frontend Type Checking & Build
- `pnpm --dir frontend tsc --noEmit` verifies strict TypeScript compilation.
- `pnpm --dir frontend build` produces an optimized Next.js production build.
