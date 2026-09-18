# Reignova Payment Service Admin Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium, production-ready enterprise Admin Portal (`/admin`) for Reignova Payment Service within the existing Next.js application, featuring live merchant lifecycle management, payment monitoring, refunds, payouts, checkout session traceability, audit logs with visual diffs, and RBAC permissions.

**Architecture:** Next.js App Router route groups separating public checkout `(checkout)` and protected admin portal `(admin)`. Built using Tailwind CSS, shadcn/ui conventions, Lucide icons, and a strict financial light theme (Stripe/Ramp inspired). Connects to live Express/Sequelize backend for `/api/v1/admin/applications` and displays structured operational empty states for pending server endpoints.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Lucide React, Express.js backend, PostgreSQL, Sequelize ORM.

**Spec:** [`docs/superpowers/specs/2026-09-18-admin-portal-design.md`](file:///Users/mbp/Desktop/Code/payment-service/docs/superpowers/specs/2026-09-18-admin-portal-design.md)

## Global Constraints

- Must coexist in the same Next.js project as public checkout without breaking `/checkout/[publicToken]` or its dark theme.
- Strict enterprise light theme for Admin Portal (`slate-50` background, `slate-200` borders, `slate-900` text, `slate-100` table headers).
- Tabular figures (`IBM Plex Mono`) for all financial amounts, currency codes, UUIDs, references, and timestamps.
- Zero plaintext secret leakage: API keys displayed once upon generation with copy button; masked elsewhere (`sk_live_••••••`).
- RBAC permissions enforced client-side with clear permission-denied indicators; destructive actions require confirmation dialogs with mandatory reasons.
- Responsive across desktop (1440px), laptop (1280px), tablet (768px), and mobile (390px).

---

### Task 1: Route Group Structure & Global Admin Context

**Files:**
- Create: `frontend/app/(admin)/layout.tsx`
- Create: `frontend/context/AdminAuthContext.tsx`
- Create: `frontend/types/admin.ts`
- Modify: `frontend/app/layout.tsx` (ensure non-interfering root font and providers)

**Interfaces:**
- Produces: `AdminAuthContextType` with `user`, `role`, `isAuthenticated`, `login()`, `logout()`, `switchRole()`, `apiKey`.
- Produces: TypeScript interfaces in `frontend/types/admin.ts` (`Application`, `Payment`, `Refund`, `Payout`, `CheckoutSession`, `AuditLog`, `AdminUser`, `Role`, `Permission`).

- [ ] **Step 1: Define TypeScript contracts in `frontend/types/admin.ts`**
Define complete types for Application/Merchant, Payment, Refund, Payout, CheckoutSession, AuditLog, and RBAC roles.

- [ ] **Step 2: Implement `AdminAuthContext.tsx`**
Create authentication context managing session token, active admin API key, user profile, role simulation switcher, and timeout detection.

- [ ] **Step 3: Create `app/(admin)/layout.tsx`**
Wrap all admin routes with `AdminAuthProvider` and clean enterprise theme root styling.

- [ ] **Step 4: Verify Next.js compilation**
Run `pnpm --dir frontend dev` check to verify route group builds cleanly.

- [ ] **Step 5: Commit**
```bash
git add frontend/app/\(admin\)/ frontend/context/ frontend/types/admin.ts
git commit -m "feat(admin): set up admin route group and auth context"
```

---

### Task 2: Typed Admin API Client Layer

**Files:**
- Create: `frontend/lib/admin-api.ts`
- Create: `frontend/lib/admin-mock-data.ts` (realistic fallback data for pending endpoints)

**Interfaces:**
- Consumes: `frontend/types/admin.ts`
- Produces: `adminApiClient` object:
  - `merchants`: `list()`, `get(id)`, `create(data)`, `rotateKey(id)`, `suspend(id, reason)`, `reactivate(id)`
  - `payments`: `list(filters)`, `get(id)`, `retry(id)`
  - `refunds`: `list(filters)`, `approve(id)`, `reject(id, reason)`
  - `payouts`: `list(filters)`, `retry(id)`, `cancel(id)`
  - `checkoutSessions`: `list(filters)`, `get(id)`
  - `auditLogs`: `list(filters)`, `get(id)`
  - `stats`: `getOverviewMetrics()`

- [ ] **Step 1: Create `admin-mock-data.ts`**
Generate realistic sample datasets for payments, refunds, payouts, checkout sessions, and audit logs matching backend Sequelize schemas.

- [ ] **Step 2: Implement `admin-api.ts`**
Connect to Express server `http://localhost:5000/api/v1/admin/applications` for real merchant CRUD. For pending backend endpoints, attempt fetch and gracefully fallback to structured empty/fallback dataset if 404/501 is returned.

- [ ] **Step 3: Test API client methods**
Verify live call against local running Express backend (`http://localhost:5000/api/v1/health` and `/api/v1/admin/applications`).

- [ ] **Step 4: Commit**
```bash
git add frontend/lib/admin-api.ts frontend/lib/admin-mock-data.ts
git commit -m "feat(admin): implement typed admin API client and fallback data layer"
```

---

### Task 3: Core Reusable Enterprise Design System Components

**Files:**
- Create: `frontend/components/admin/StatusBadge.tsx`
- Create: `frontend/components/admin/MetricCard.tsx`
- Create: `frontend/components/admin/PageHeader.tsx`
- Create: `frontend/components/admin/DataTable.tsx`
- Create: `frontend/components/admin/DataTableToolbar.tsx`
- Create: `frontend/components/admin/EmptyState.tsx`
- Create: `frontend/components/admin/ConfirmDialog.tsx`
- Create: `frontend/components/admin/PermissionGate.tsx`
- Create: `frontend/components/admin/DetailsDrawer.tsx`

**Interfaces:**
- Produces: Clean UI primitives matching Stripe/Ramp financial design system.

- [ ] **Step 1: Build `StatusBadge.tsx`**
Supports `ACTIVE`, `SUSPENDED`, `REVOKED`, `COMPLETED`, `PENDING`, `PROCESSING`, `FAILED`, `CANCELLED`, `EXPIRED`, `APPROVED`, `REJECTED`, `UNDER_REVIEW` with 6px indicator dot.

- [ ] **Step 2: Build `MetricCard.tsx`**
Monospace formatted value, percentage trend badge (`+14.2%`), trend direction icon, subtitle, tooltip info trigger.

- [ ] **Step 3: Build `PageHeader.tsx`**
Title, subtitle, badge counter, and action slots.

- [ ] **Step 4: Build `DataTable.tsx` & `DataTableToolbar.tsx`**
Generic typed table with column sorting, hover states, pagination, search input, status filters, and skeleton loader.

- [ ] **Step 5: Build `EmptyState.tsx`, `ConfirmDialog.tsx`, `PermissionGate.tsx`, and `DetailsDrawer.tsx`**
Reusable modals, drawers, and permission wrappers.

- [ ] **Step 6: Commit**
```bash
git add frontend/components/admin/
git commit -m "feat(admin): build reusable enterprise design system components"
```

---

### Task 4: Admin Shell Layout (Sidebar, Header, Breadcrumbs)

**Files:**
- Create: `frontend/components/admin/AdminSidebar.tsx`
- Create: `frontend/components/admin/AdminHeader.tsx`
- Create: `frontend/components/admin/CommandSearchDialog.tsx`
- Create: `frontend/app/(admin)/admin/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `AdminAuthContext`, `components/admin/*`
- Produces: The complete dashboard shell with collapsible navigation, mobile drawer, breadcrumbs, search palette, and role switcher.

- [ ] **Step 1: Implement `AdminSidebar.tsx`**
Reignova logo, "Payment Service" title, environment pill (`LIVE / PRODUCTION`), navigation items, user card with role switcher and sign out.

- [ ] **Step 2: Implement `AdminHeader.tsx` & `CommandSearchDialog.tsx`**
Breadcrumbs auto-computed from URL segments, `Cmd+K` global command search dialog, notifications menu, and health ping.

- [ ] **Step 3: Implement `(dashboard)/layout.tsx`**
Assemble layout shell with desktop sidebar, mobile sheet drawer, header, and main content area.

- [ ] **Step 4: Verify navigation highlighting**
Ensure active route is highlighted cleanly across all top-level paths.

- [ ] **Step 5: Commit**
```bash
git add frontend/components/admin/AdminSidebar.tsx frontend/components/admin/AdminHeader.tsx frontend/components/admin/CommandSearchDialog.tsx frontend/app/\(admin\)/admin/\(dashboard\)/layout.tsx
git commit -m "feat(admin): implement responsive admin shell layout and command palette"
```

---

### Task 5: Admin Login Experience (`/admin/login`)

**Files:**
- Create: `frontend/app/(admin)/admin/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `AdminAuthContext`
- Produces: `/admin/login` page with authentication form, demo role quick-fill buttons, error states, and session timeout alerts.

- [ ] **Step 1: Implement login form with credential inputs**
Admin email/username and API key/password input fields with validation and loading state.

- [ ] **Step 2: Add quick-fill demo accounts**
Provide 1-click test credential buttons for `Super Admin`, `Operations Admin`, `Finance Admin`, and `Auditor`.

- [ ] **Step 3: Add error banner and redirect logic**
Handle invalid credentials and automatic redirect to `/admin` or origin route on successful login.

- [ ] **Step 4: Commit**
```bash
git add frontend/app/\(admin\)/admin/\(auth\)/login/page.tsx
git commit -m "feat(admin): implement admin login page with role switcher and demo presets"
```

---

### Task 6: Operational Command Center Dashboard (`/admin`)

**Files:**
- Create: `frontend/app/(admin)/admin/(dashboard)/page.tsx`
- Create: `frontend/components/admin/VolumeTrendChart.tsx`
- Create: `frontend/components/admin/ProviderDistributionWidget.tsx`
- Create: `frontend/components/admin/OperationalAlertsBanner.tsx`

**Interfaces:**
- Consumes: `adminApiClient`, `components/admin/*`
- Produces: `/admin` command center with 6 KPI cards, volume trend SVG chart, provider performance, status breakdown, operational alert banner, and recent transactions.

- [ ] **Step 1: Implement KPI metric cards row**
Total Volume, Successful Transactions (with success rate %), Pending Queue, Failed Transactions (with failure rate %), Active Merchants, Refund Volume.

- [ ] **Step 2: Build `VolumeTrendChart.tsx`**
Lightweight SVG area chart showing 30-day transaction volume trend with hover tooltip.

- [ ] **Step 3: Build `ProviderDistributionWidget.tsx` & `OperationalAlertsBanner.tsx`**
Provider success breakdown (Pawapay, M-Pesa, Airtel, TigoPesa) and high-priority operational alerts banner.

- [ ] **Step 4: Build recent activity and top active merchants table**
Assemble the full command center page.

- [ ] **Step 5: Commit**
```bash
git add frontend/app/\(admin\)/admin/\(dashboard\)/page.tsx frontend/components/admin/VolumeTrendChart.tsx frontend/components/admin/ProviderDistributionWidget.tsx frontend/components/admin/OperationalAlertsBanner.tsx
git commit -m "feat(admin): implement operational command center dashboard"
```

---

### Task 7: Live Merchant Management & Details (`/admin/merchants`)

**Files:**
- Create: `frontend/app/(admin)/admin/(dashboard)/merchants/page.tsx`
- Create: `frontend/app/(admin)/admin/(dashboard)/merchants/[id]/page.tsx`
- Create: `frontend/components/admin/AddMerchantModal.tsx`
- Create: `frontend/components/admin/DisplayOnceKeyModal.tsx`

**Interfaces:**
- Consumes: `adminApiClient.merchants` (live backend CRUD!)
- Produces: List view, Add Merchant wizard, display-once key reveal dialog, and merchant details page with 6 inspection tabs.

- [ ] **Step 1: Implement `merchants/page.tsx`**
Connect to live backend `GET /api/v1/admin/applications` with status filtering, search by name/slug, and pagination.

- [ ] **Step 2: Implement `AddMerchantModal.tsx` & `DisplayOnceKeyModal.tsx`**
Form submitting to `POST /api/v1/admin/applications`. On success, open `DisplayOnceKeyModal` showing generated `apiKey` with copy button and warning notice.

- [ ] **Step 3: Implement `merchants/[id]/page.tsx`**
Header with status badge, slug, copyable UUID. 6 inspection tabs: Overview, Payments, Checkout Sessions, API Credentials (with rotate key trigger), Audit History, Danger Zone (Suspend/Reactivate).

- [ ] **Step 4: Test live merchant operations**
Create a test merchant, verify it persists in database, test rotate key, suspend, and reactivate.

- [ ] **Step 5: Commit**
```bash
git add frontend/app/\(admin\)/admin/\(dashboard\)/merchants/ frontend/components/admin/AddMerchantModal.tsx frontend/components/admin/DisplayOnceKeyModal.tsx
git commit -m "feat(admin): implement live merchant management and details inspector"
```

---

### Task 8: Payment Monitoring & Details Drawer (`/admin/payments`)

**Files:**
- Create: `frontend/app/(admin)/admin/(dashboard)/payments/page.tsx`
- Create: `frontend/components/admin/PaymentDetailsDrawer.tsx`
- Create: `frontend/components/admin/StatusTimeline.tsx`

**Interfaces:**
- Consumes: `adminApiClient.payments`, `types/admin.ts`
- Produces: High-density payment monitoring table, multi-facet filtering, export action, and payment details drawer with status timeline.

- [ ] **Step 1: Implement `StatusTimeline.tsx`**
Chronological state visualization (`Created` → `Initiated` → `Processing` → `Completed`/`Failed`) with failure annotations.

- [ ] **Step 2: Implement `PaymentDetailsDrawer.tsx`**
Customer info (masked phone), provider transaction ID, status timeline, retry action (permission gated), and raw JSON metadata inspector.

- [ ] **Step 3: Implement `payments/page.tsx`**
Payment table with sorting, search, merchant and status filter dropdowns, and drawer trigger.

- [ ] **Step 4: Commit**
```bash
git add frontend/app/\(admin\)/admin/\(dashboard\)/payments/page.tsx frontend/components/admin/PaymentDetailsDrawer.tsx frontend/components/admin/StatusTimeline.tsx
git commit -m "feat(admin): implement payment monitoring table and details drawer"
```

---

### Task 9: Refund & Payout Operations (`/admin/refunds` & `/admin/payouts`)

**Files:**
- Create: `frontend/app/(admin)/admin/(dashboard)/refunds/page.tsx`
- Create: `frontend/app/(admin)/admin/(dashboard)/payouts/page.tsx`
- Create: `frontend/components/admin/RefundApprovalModal.tsx`
- Create: `frontend/components/admin/RefundRejectModal.tsx`

**Interfaces:**
- Consumes: `adminApiClient.refunds`, `adminApiClient.payouts`, `PermissionGate`
- Produces: Refund and payout operations tables with approval, mandatory-reason rejection, and confirmation dialogs.

- [ ] **Step 1: Implement `RefundApprovalModal.tsx` & `RefundRejectModal.tsx`**
Approve modal showing refund amount, original reference, and async provider notice. Reject modal requiring mandatory reason input.

- [ ] **Step 2: Implement `refunds/page.tsx`**
Table displaying Refund ID, Original Payment Ref, Merchant, Amount, Status, Requested By, Approved By.

- [ ] **Step 3: Implement `payouts/page.tsx`**
Payout table with recipient, amount, provider, status, created date, and retry/cancel actions.

- [ ] **Step 4: Commit**
```bash
git add frontend/app/\(admin\)/admin/\(dashboard\)/refunds/ frontend/app/\(admin\)/admin/\(dashboard\)/payouts/ frontend/components/admin/RefundApprovalModal.tsx frontend/components/admin/RefundRejectModal.tsx
git commit -m "feat(admin): implement refund and payout operations"
```

---

### Task 10: Checkout Sessions Traceability (`/admin/checkout-sessions`)

**Files:**
- Create: `frontend/app/(admin)/admin/(dashboard)/checkout-sessions/page.tsx`
- Create: `frontend/components/admin/SessionTraceabilityCard.tsx`

**Interfaces:**
- Consumes: `adminApiClient.checkoutSessions`
- Produces: Checkout session monitoring table and lifecycle traceability view (`Merchant` → `Checkout Session` → `Payment` → `Provider`).

- [ ] **Step 1: Build `SessionTraceabilityCard.tsx`**
Visual lifecycle chain showing relationship between Merchant, Session ID, Payment Attempt, and Provider Transaction. Masks public token (`tok_••••••••`).

- [ ] **Step 2: Implement `checkout-sessions/page.tsx`**
Table listing Session ID, Merchant, Reference, Amount, Session Status, Payment Status, Expires At, and inspection drawer.

- [ ] **Step 3: Commit**
```bash
git add frontend/app/\(admin\)/admin/\(dashboard\)/checkout-sessions/ frontend/components/admin/SessionTraceabilityCard.tsx
git commit -m "feat(admin): implement checkout session monitoring and traceability"
```

---

### Task 11: Audit Logs & Visual Diff Viewer (`/admin/audit-logs`)

**Files:**
- Create: `frontend/app/(admin)/admin/(dashboard)/audit-logs/page.tsx`
- Create: `frontend/components/admin/AuditLogDiff.tsx`
- Create: `frontend/components/admin/AuditLogDetailsDrawer.tsx`

**Interfaces:**
- Consumes: `adminApiClient.auditLogs`
- Produces: Audit log compliance table, multi-facet filter toolbar, and visual diff inspector with automated secret masking.

- [ ] **Step 1: Build `AuditLogDiff.tsx`**
Key-value diff viewer displaying added, changed, and removed attributes with secret masking (`sk_live_••••••`).

- [ ] **Step 2: Build `AuditLogDetailsDrawer.tsx`**
Displays Correlation ID, IP address, user agent, actor details, and the embedded diff viewer.

- [ ] **Step 3: Implement `audit-logs/page.tsx`**
Table with Timestamp, Actor, Action, Resource Type, Resource ID, Merchant, Result, and IP Address.

- [ ] **Step 4: Commit**
```bash
git add frontend/app/\(admin\)/admin/\(dashboard\)/audit-logs/ frontend/components/admin/AuditLogDiff.tsx frontend/components/admin/AuditLogDetailsDrawer.tsx
git commit -m "feat(admin): implement audit log viewer and visual diff inspector"
```

---

### Task 12: Platform Settings, RBAC & Permission States (`/admin/settings`)

**Files:**
- Create: `frontend/app/(admin)/admin/(dashboard)/settings/page.tsx`
- Create: `frontend/components/admin/PermissionDeniedBanner.tsx`

**Interfaces:**
- Consumes: `AdminAuthContext`, `types/admin.ts`
- Produces: Settings page with Platform Config, Webhooks, Provider corridors, and interactive Role & Permissions matrix with live permission-denied preview.

- [ ] **Step 1: Build `PermissionDeniedBanner.tsx`**
Polished 403 Forbidden card with `ShieldAlert` icon, required permission explanation, and return trigger.

- [ ] **Step 2: Implement `settings/page.tsx`**
Tabbed settings interface: Platform Configuration, Provider Settings, Webhook Settings, Admin Users & RBAC Matrix, Audit Retention Policies.

- [ ] **Step 3: Add interactive role preview**
Switch roles in the settings page to demonstrate permission gating in real-time.

- [ ] **Step 4: Commit**
```bash
git add frontend/app/\(admin\)/admin/\(dashboard\)/settings/page.tsx frontend/components/admin/PermissionDeniedBanner.tsx
git commit -m "feat(admin): implement platform settings and RBAC permission management"
```

---

### Task 13: End-to-End Verification & Responsive Polish

**Files:**
- Modify: `frontend/app/globals.css` (verify smooth transitions and custom scrollbar for admin)
- Test: Full responsive views (390px, 768px, 1280px, 1440px)
- Test: Live checkout route `/checkout/[publicToken]` for regressions

- [ ] **Step 1: Typecheck and Build**
Run `pnpm --dir frontend build` (or `tsc --noEmit`) to verify zero TypeScript or Next.js build errors.

- [ ] **Step 2: Verify Checkout Isolation**
Navigate to public checkout link to verify dark theme and customer checkout form function with zero visual interference.

- [ ] **Step 3: Verify Admin Flow**
Test `/admin/login` → `/admin` → `/admin/merchants` (create merchant and rotate key) → `/admin/payments` → `/admin/audit-logs` → `/admin/settings`.

- [ ] **Step 4: Commit**
```bash
git add frontend/
git commit -m "chore(admin): polish responsive layouts and finalize verification"
```
