# Reignova Checkout Frontend & Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready, highly secure, branded Next.js checkout frontend and backend public checkout endpoints for Reignova Technologies within the existing `payment-service` repository.

**Architecture:** Next.js 14+ App Router frontend residing in `frontend/` powered by Tailwind CSS and Reignova design tokens, connected to newly added public, rate-limited Express endpoints (`/api/v1/checkouts/public/*`). Webhook-synchronized status polling coordinates real-time mobile money prompt confirmation with zero client credentials exposure.

**Tech Stack:** Express.js, TypeScript, PostgreSQL, Sequelize ORM, Pawapay, Next.js 14+, Tailwind CSS, React Hook Form, Zod, Lucide React, Vitest, Supertest.

**Spec:** [docs/superpowers/specs/2026-09-18-reignova-checkout-frontend-design.md](file:///Users/mbp/Desktop/Code/payment-service/docs/superpowers/specs/2026-09-18-reignova-checkout-frontend-design.md)

## Global Constraints
- Target domain: `https://pay.reignovatechnologies.com` with routes `/checkout/:publicToken` and `/api/v1/*`.
- Single repository structure (Option 1): backend remains in `src/`, frontend in `frontend/`.
- All 116 existing tests must continue to pass without regression.
- Zero leakage of internal IDs, API keys, webhook secrets, or provider credentials to public clients.
- Amount and currency are strictly server-validated against database records.
- Support Tanzania mobile money providers: Vodacom M-Pesa (`VODACOM_TZA`), Tigo Pesa (`TIGO_TZA`), Airtel Money (`AIRTEL_TZA`), Halotel (`HALOTEL_TZA`).

---

### Task 1: Database Migration & Model Updates

**Files:**
- Create: `src/database/migrations/010-add-public-token-to-checkouts.ts`
- Modify: `src/models/checkout.model.ts:14-41`, `src/models/checkout.model.ts:70-100`, `src/models/checkout.model.ts:102-247`
- Modify: `src/config/env.ts:32-58`
- Modify: `src/repositories/checkout.repository.ts:40-57`
- Test: `tests/unit/models/checkout-migration.test.ts`

**Interfaces:**
- Consumes: Sequelize `queryInterface`, `env` schema
- Produces: `CheckoutAttributes.publicToken`, `CheckoutAttributes.cancelUrl`, `CheckoutRepository.findByPublicToken(token: string)`

- [ ] **Step 1: Write migration `010-add-public-token-to-checkouts.ts`**
Add `public_token`, `cancel_url`, `customer_name`, `customer_email`, `customer_phone` columns and index on `public_token`.

- [ ] **Step 2: Update `Checkout` model and `env.ts`**
Add `CHECKOUT_BASE_URL` to `src/config/env.ts`, add `publicToken` and `cancelUrl` to `Checkout` model attributes and repository.

- [ ] **Step 3: Run migration command**
Run: `pnpm db:migrate`
Expected: Migration 010 executes successfully.

- [ ] **Step 4: Verify existing tests pass**
Run: `pnpm test`
Expected: 116 passed.

- [ ] **Step 5: Commit**
```bash
git add src/database/migrations/010-add-public-token-to-checkouts.ts src/models/checkout.model.ts src/config/env.ts src/repositories/checkout.repository.ts
git commit -m "feat(db): add public_token and cancel_url to checkouts"
```

---

### Task 2: Normalized Checkout Schema & Checkout Service Token Generation

**Files:**
- Modify: `src/schemas/checkout.schema.ts:10-50`
- Modify: `src/services/checkout.service.ts:14-32`, `src/services/checkout.service.ts:99-175`
- Test: `tests/unit/schemas/payout-refund-checkout-validation.test.ts`

**Interfaces:**
- Consumes: `CreateCheckoutDto`, `createCheckoutSchema`
- Produces: `CheckoutResponse.publicToken`, `CheckoutResponse.checkoutUrl`, normalized creation supporting `{ amount, currency, country, customer, successUrl, cancelUrl }`.

- [ ] **Step 1: Update `checkout.schema.ts`**
Accept optional top-level `amount`, `currency`, `country`, `customer`, `successUrl`, `cancelUrl` alongside existing fields.

- [ ] **Step 2: Update `checkout.service.ts`**
Generate `publicToken = 'cs_sec_' + crypto.randomBytes(24).toString('hex')`. Set `checkoutUrl = `${env.CHECKOUT_BASE_URL}/checkout/${publicToken}`. Save `publicToken` and `cancelUrl`.

- [ ] **Step 3: Run schema and checkout tests**
Run: `pnpm vitest run tests/unit/schemas/payout-refund-checkout-validation.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add src/schemas/checkout.schema.ts src/services/checkout.service.ts
git commit -m "feat(checkout): generate publicToken and support simplified checkout session payload"
```

---

### Task 3: Public Checkout Express Endpoints & Webhook Synchronization

**Files:**
- Create: `src/controllers/public-checkout.controller.ts`
- Create: `src/routes/public-checkout.routes.ts`
- Modify: `src/routes/index.ts:10-59`
- Modify: `src/services/webhook.service.ts:420-554`
- Test: `tests/integration/public-checkout.test.ts`

**Interfaces:**
- Consumes: `checkoutRepository`, `paymentService`, `webhookService`
- Produces:
  - `GET /api/v1/checkouts/public/:publicToken` (sanitized session data + provider list)
  - `POST /api/v1/checkouts/public/:publicToken/pay` (initiates deposit with stored amount & provider)
  - `GET /api/v1/checkouts/public/:publicToken/status` (polling endpoint)
  - `POST /api/v1/checkouts/public/:publicToken/cancel` (cancellation)

- [ ] **Step 1: Write integration tests `tests/integration/public-checkout.test.ts`**
Define test cases covering retrieval, invalid token 404, expiry handling, payment initiation, duplicate prevention, and webhook updates.

- [ ] **Step 2: Implement `public-checkout.controller.ts` & `public-checkout.routes.ts`**
Implement controller methods with sanitization, input validation, deposit linkage, and rate limiting. Mount router in `src/routes/index.ts` under `/api/v1/checkouts/public`.

- [ ] **Step 3: Update `webhook.service.ts` for deposit-to-checkout synchronization**
When deposit completes/fails via Pawapay webhook, locate linked checkout and transition its status to `COMPLETED` / `FAILED`.

- [ ] **Step 4: Run integration tests**
Run: `pnpm vitest run tests/integration/public-checkout.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**
Run: `pnpm test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**
```bash
git add src/controllers/public-checkout.controller.ts src/routes/public-checkout.routes.ts src/routes/index.ts src/services/webhook.service.ts tests/integration/public-checkout.test.ts
git commit -m "feat(api): implement public checkout endpoints and webhook synchronization"
```

---

### Task 4: Next.js Checkout Frontend Scaffolding & Theme Configuration

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.mjs`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/app/globals.css`
- Create: `frontend/app/layout.tsx`
- Modify: `package.json:7-34` (root scripts)

**Interfaces:**
- Produces: Working Next.js 14+ application with Reignova theme tokens (Navy `#0F1A25`, Gold/Amber `#F3A221`, Cream `#F7F5F0`, Slate `#5B6472`, Montserrat & IBM Plex Mono fonts).

- [ ] **Step 1: Create `frontend/` package configuration and install dependencies**
Install `next`, `react`, `react-dom`, `lucide-react`, `react-hook-form`, `@hookform/resolvers`, `zod`, `clsx`, `tailwind-merge`.

- [ ] **Step 2: Configure Tailwind and Reignova design system in `globals.css`**
Define CSS variables, circuit-trace motifs, and font families matching [reignovatechnologies.com](https://reignovatechnologies.com/).

- [ ] **Step 3: Setup root `layout.tsx` with SEO meta tags and fonts**
Include Google Fonts link for Montserrat and IBM Plex Mono.

- [ ] **Step 4: Update root `package.json` scripts**
Add `"dev:frontend"`, `"build:frontend"`, and `"dev:all"`.

- [ ] **Step 5: Verify build**
Run: `pnpm --dir frontend build`
Expected: Next.js build succeeds.

- [ ] **Step 6: Commit**
```bash
git add frontend/ package.json
git commit -m "feat(frontend): scaffold Next.js checkout application with Reignova design tokens"
```

---

### Task 5: Frontend API Client, Types, Formatters & Polling Hook

**Files:**
- Create: `frontend/types/checkout.ts`
- Create: `frontend/lib/api-client.ts`
- Create: `frontend/lib/checkout-api.ts`
- Create: `frontend/lib/formatters.ts`
- Create: `frontend/lib/validation.ts`
- Create: `frontend/hooks/use-checkout-status.ts`
- Test: `frontend/lib/formatters.test.ts`

**Interfaces:**
- Produces: Typed API methods (`getCheckoutSession`, `initiatePayment`, `getCheckoutStatus`, `cancelCheckout`), currency/phone formatters, and status polling hook `useCheckoutStatus`.

- [ ] **Step 1: Define TypeScript interfaces in `frontend/types/checkout.ts`**
Declare `CheckoutSessionData`, `InitiatePaymentPayload`, `CheckoutStatusResponse`, `PaymentProviderOption`.

- [ ] **Step 2: Implement `api-client.ts` and `checkout-api.ts`**
Implement typed fetch handling `NEXT_PUBLIC_API_BASE_URL` with error normalization.

- [ ] **Step 3: Implement `formatters.ts` and `validation.ts`**
Currency formatting (`formatCurrency`), phone input validator (Tanzania phone formatting), and Zod form schema.

- [ ] **Step 4: Implement `use-checkout-status.ts`**
Adaptive polling (2.5s interval, max 3 min timeout, cleanup on unmount, callback triggers).

- [ ] **Step 5: Verify type correctness**
Run: `pnpm --dir frontend tsc --noEmit`
Expected: 0 type errors.

- [ ] **Step 6: Commit**
```bash
git add frontend/types/ frontend/lib/ frontend/hooks/
git commit -m "feat(frontend): add typed API client, validation, formatters, and polling hook"
```

---

### Task 6: Reignova Checkout UI Components & Interactive States

**Files:**
- Create: `frontend/components/ui/Button.tsx`, `frontend/components/ui/Input.tsx`, `frontend/components/ui/Badge.tsx`, `frontend/components/ui/Card.tsx`
- Create: `frontend/components/checkout/CheckoutHeader.tsx`
- Create: `frontend/components/checkout/CheckoutLayout.tsx`
- Create: `frontend/components/checkout/MerchantSummary.tsx`
- Create: `frontend/components/checkout/PaymentSummary.tsx`
- Create: `frontend/components/checkout/CustomerDetailsForm.tsx`
- Create: `frontend/components/checkout/PaymentMethodSelector.tsx`
- Create: `frontend/components/checkout/states/CheckoutSkeleton.tsx`
- Create: `frontend/components/checkout/states/CheckoutProcessing.tsx`
- Create: `frontend/components/checkout/states/CheckoutSuccess.tsx`
- Create: `frontend/components/checkout/states/CheckoutFailed.tsx`
- Create: `frontend/components/checkout/states/CheckoutExpired.tsx`
- Create: `frontend/components/checkout/states/CheckoutCancelled.tsx`
- Create: `frontend/app/checkout/[publicToken]/page.tsx`

**Interfaces:**
- Produces: Complete checkout user experience supporting form submission, provider switching, USSD PIN prompt instructions, polling status transitions, and verified return redirect.

- [ ] **Step 1: Create accessible UI primitives in `frontend/components/ui/`**
Buttons with loading states, phone inputs, status badges with Reignova styling.

- [ ] **Step 2: Implement header, merchant summary, and payment summary**
Reignova logo with SVG brand mark, "Reignova Secure Checkout" badge with 256-bit encryption indicator, merchant details, total price badge.

- [ ] **Step 3: Implement `CustomerDetailsForm.tsx` and `PaymentMethodSelector.tsx`**
Form with React Hook Form + Zod. Provider cards for Vodacom M-Pesa, Tigo Pesa, Airtel Money, Halotel with operator brand colors and active highlight states.

- [ ] **Step 4: Implement checkout state components in `components/checkout/states/`**
- `CheckoutSkeleton.tsx`: smooth shimmer placeholders.
- `CheckoutProcessing.tsx`: animated phone prompt indicator with clear instructions to check mobile device.
- `CheckoutSuccess.tsx`: green checkmark, transaction details, and return button.
- `CheckoutFailed.tsx`: error description and retry flow.
- `CheckoutExpired.tsx`: clear expiry notice.
- `CheckoutCancelled.tsx`: customer cancellation view.

- [ ] **Step 5: Assemble `frontend/app/checkout/[publicToken]/page.tsx`**
Coordinate loading, form submission, USSD polling, and result states.

- [ ] **Step 6: Build & type-check frontend**
Run: `pnpm --dir frontend build`
Expected: Next.js production build succeeds with 0 errors.

- [ ] **Step 7: Commit**
```bash
git add frontend/components/ frontend/app/
git commit -m "feat(frontend): implement Reignova checkout UI components and state screens"
```

---

### Task 7: End-to-End Verification, Documentation & Postman Update

**Files:**
- Modify: `README.md`
- Create: `docs/checkout-frontend.md`
- Modify: `src/scripts/generate-postman.ts`
- Run: `pnpm generate:postman`
- Run: `pnpm test`
- Run: `pnpm --dir frontend build`

**Interfaces:**
- Produces: Comprehensive documentation for local execution, production deployment (`pay.reignovatechnologies.com`), updated Postman collection with public endpoints, and verified test results.

- [ ] **Step 1: Update Postman generator and regenerate collections**
Add public checkout requests (`Get Public Checkout`, `Initiate Public Payment`, `Check Public Status`, `Cancel Checkout`). Run `pnpm generate:postman`.

- [ ] **Step 2: Create `docs/checkout-frontend.md` and update `README.md`**
Document architecture diagram, environment variables, reverse proxy configuration (Nginx / Cloudflare), and cURL test commands.

- [ ] **Step 3: Run full backend and frontend verification**
Run: `pnpm test` (verify 100% pass)
Run: `pnpm --dir frontend build` (verify build passes)

- [ ] **Step 4: Commit**
```bash
git add README.md docs/checkout-frontend.md docs/payment-service.postman_collection.json payment-service.postman_collection.json src/scripts/generate-postman.ts
git commit -m "docs: add checkout frontend guide, Nginx config, and updated Postman collections"
```
