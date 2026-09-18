# Reignova Payment Service Admin Portal — Design Specification

**Author**: Senior Product Designer & Enterprise Fintech UX Architect  
**Date**: September 18, 2026  
**Status**: Validated Design Spec  
**Target Platform**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Lucide React, Express backend (PostgreSQL + Sequelize)

---

## 1. Executive Summary & Objective

The Reignova Payment Service is an enterprise-grade multi-tenant payment microservice designed for modern African commerce. While customer transactions are orchestrated via the public hosted checkout experience (`/checkout/[publicToken]`), internal operations staff, financial administrators, compliance officers, and support engineers require a dedicated, high-performance **Admin Portal** (`/admin`).

This document defines the comprehensive design specification and technical architecture for the Reignova Admin Portal, coexisting within the existing Next.js application while maintaining strict structural, visual, and security separation.

---

## 2. Information Architecture & Routing

The Admin Portal is housed in a dedicated Next.js App Router route group `app/(admin)/admin` to isolate its layout, authentication boundaries, and stylesheets from the public checkout flow:

```text
frontend/app/
├── (checkout)/                           # Public customer-facing checkout
│   ├── checkout/
│   │   └── [publicToken]/
│   │       └── page.tsx                  # Public Checkout experience
│   └── page.tsx                          # Public landing page
└── (admin)/                              # Protected Admin Portal subsystem
    ├── layout.tsx                        # Global admin shell & context provider
    └── admin/
        ├── (auth)/
        │   └── login/
        │       └── page.tsx              # /admin/login (Admin authentication)
        └── (dashboard)/
            ├── layout.tsx                # Dashboard shell (Sidebar, Header, Breadcrumbs)
            ├── page.tsx                  # /admin (Overview Command Center)
            ├── merchants/
            │   ├── page.tsx              # /admin/merchants (List, Filter, Add modal)
            │   └── [id]/
            │       └── page.tsx          # /admin/merchants/[id] (Multi-tab inspector)
            ├── payments/
            │   └── page.tsx              # /admin/payments (Monitoring table + drawer)
            ├── refunds/
            │   └── page.tsx              # /admin/refunds (Review, Approve, Reject)
            ├── payouts/
            │   └── page.tsx              # /admin/payouts (Operations table)
            ├── checkout-sessions/
            │   └── page.tsx              # /admin/checkout-sessions (Session traceability)
            ├── audit-logs/
            │   └── page.tsx              # /admin/audit-logs (Diff investigation viewer)
            └── settings/
                └── page.tsx              # /admin/settings (Platform, RBAC, Webhooks)
```

---

## 3. Design Direction & Visual System

Inspired by top-tier financial platforms like **Stripe Dashboard**, **Linear**, and **Ramp**, the Admin Portal adopts a **strict enterprise light theme** built for clarity, high data density, and operational focus.

### 3.1 Color Foundations
* **Page Canvas Background**: `#F8FAFC` (`slate-50`)
* **Card & Panel Surfaces**: `#FFFFFF` with `#E2E8F0` (`slate-200`) fine border and restrained shadow (`shadow-xs` / `shadow-sm`)
* **Header & Table Header Background**: `#F1F5F9` (`slate-100`)
* **Primary Text**: `#0F172A` (`slate-900`) for headers and primary values; `#475569` (`slate-600`) for body/secondary text
* **Brand Accent**: Reignova Gold / Amber (`#F3A221` / `#D97706`) utilized sparingly for active indicators, primary call-to-actions, and key metrics.

### 3.2 Typography & Numerical Clarity
* **Primary UI Font**: `Inter` / `Montserrat` with tight tracking (`tracking-tight`) for headings and crisp UI labels.
* **Monospace Tabular Figures**: `IBM Plex Mono` applied to all monetary figures, currency symbols, UUIDs, transaction references, API key prefixes, and timestamps (`tabular-nums font-mono`). This ensures vertical alignment across table columns and metric cards.

### 3.3 Semantic Financial Status Tokens
* **Completed / Active / Approved / Success**: Emerald Green (`bg-emerald-50 text-emerald-700 border-emerald-200`)
* **Processing / Initiated / Pending / Under Review**: Warm Amber (`bg-amber-50 text-amber-700 border-amber-200`)
* **Failed / Revoked / Rejected / Suspended**: Controlled Crimson (`bg-rose-50 text-rose-700 border-rose-200`)
* **Cancelled / Expired / Neutral**: Slate Neutral (`bg-slate-100 text-slate-700 border-slate-200`)

---

## 4. Reusable Enterprise Component Architecture

All views in the admin portal are composed of standard, reusable components adhering to shadcn/ui conventions and Lucide React iconography:

### 4.1 Shell Components
1. **`AdminSidebar`**:
   * Reignova wordmark + "Payment Service" logo header.
   * Environment indicator tag: `PRODUCTION` (green pulse) / `SANDBOX` (amber).
   * Navigation links with exact and prefix path matching (`Overview`, `Merchants`, `Payments`, `Payouts`, `Refunds`, `Checkout Sessions`, `Audit Logs`, `Settings`).
   * Collapsible desktop behavior (persisted via local state) and sliding mobile sheet drawer (`< 1024px`).
   * Footer user card: Admin avatar, name, email, active role badge (`Super Admin`), role switcher for testing permissions, and a Sign Out button.
2. **`AdminHeader`**:
   * Dynamic breadcrumbs calculated from the URL segments.
   * Global command search palette shortcut (`Cmd+K`).
   * Operational Notification popover.
   * Direct link to API health status (`/health`).

### 4.2 Data & Operational Components
3. **`PageHeader`**: Title, subtitle, badge counter, and primary/secondary action slots.
4. **`MetricCard`**: Monospace formatted figure, comparison time period, percentage trend pill (`+14.2%`), trend direction icon, and contextual help tooltip.
5. **`DataTable<TData>`**: Standardized table with sticky header, column sorting, loading shimmer skeleton, empty state fallback, and responsive horizontal overflow.
6. **`DataTableToolbar`**: Debounced search input, faceted dropdown filters (Status, Merchant, Provider, Date Range), active filter reset button, and export action.
7. **`StatusBadge`**: Pill badge containing a 6px status dot and standardized financial status text.
8. **`DetailsDrawer`**: 520px-600px slide-over inspector sheet with structured metadata rows, raw JSON viewer, and quick copy triggers.
9. **`StatusTimeline`**: Vertical chronological state flow (`Created` → `Initiated` → `Processing` → `Completed`/`Failed`) with timestamp and error annotations.
10. **`AuditLogDiff`**: Visual key-value diff viewer highlighting added, modified, and removed attributes between states, with automated secret redaction (`sk_live_••••••`).
11. **`PermissionGate`**: RBAC wrapper that hides or disables actions with contextual explanation if the user's role lacks necessary permissions.
12. **`ConfirmDialog`**: High-risk action confirmation modal with mandatory reason input and typing verification for destructive changes.
13. **`EmptyState`**: Contextual visual state with Lucide icon, explanatory copy, and relevant primary call-to-action.

---

## 5. View Specifications & User Flows

### 5.1 Admin Authentication (`/admin/login`)
* **Visual Presentation**: Centered financial login card with Reignova branding, clear environment badge, and security notice.
* **Fields**: Email / Username, Password or Admin API Key.
* **Operational Conveniences**: Quick-fill demo credentials for authorized role testing (`Super Admin`, `Operations Admin`, `Finance Admin`, `Auditor`).
* **States**:
  * Default sign-in form.
  * Loading spinner on submission.
  * Authentication error banner with specific error messaging.
  * Session expired alert banner when redirected after idle timeout.

### 5.2 Dashboard Overview (`/admin`)
* **KPI Matrix**:
  * Total Payment Volume (with period comparison).
  * Successful Transactions (count + success rate %).
  * Pending Queue (transactions currently processing).
  * Failed Transactions (with failure rate anomaly indicator).
  * Active Merchants (active count vs suspended count).
  * Total Refund Volume.
* **Operational Charts**:
  * 30-Day Volume Trend (clean SVG area chart).
  * Payment Status Distribution (horizontal split progress bar).
  * Provider Performance (Pawapay, M-Pesa, Airtel, TigoPesa success rates and latency).
* **Actionable Alert Center**:
  * High-priority operational callouts: pending refunds awaiting approval, webhook delivery errors, and suspended merchants requiring review.

### 5.3 Merchant Management (`/admin/merchants` & `/admin/merchants/[id]`)
* **List View (`/admin/merchants`)**:
  * Connected to backend `GET /api/v1/admin/applications`.
  * Columns: Name, Slug, Status, API Key Prefix, Webhook URL, Created Date, Actions.
  * Filter by Status (`ACTIVE`, `SUSPENDED`, `REVOKED`), search by name/slug.
* **Add Merchant Modal**:
  * Input fields: Name, unique Slug (auto-slugified from name), Description, Webhook URL, Webhook Secret.
  * Validation: Name required, slug alphanumeric with hyphens, webhook URL valid HTTPS.
  * **Display-Once Credential Modal**: Upon creation, displays generated `apiKey` with one-click copy and warning: *"This API key will never be displayed again. Store it securely."*
* **Merchant Details (`/admin/merchants/[id]`)**:
  * Header: Application Name, status pill, application UUID with quick-copy.
  * **Tabs**:
    1. *Overview*: Metadata, configuration, quick statistics.
    2. *Payments*: Payments initiated by this application.
    3. *Checkout Sessions*: Hosted checkout sessions generated by this application.
    4. *Credentials*: Displays API key prefix, date created, and "Rotate API Key" trigger.
    5. *Audit History*: Chronological audit logs filtered to this `application_id`.
    6. *Danger Zone*: Suspend application (with confirmation reason) and Reactivate application.

### 5.4 Payment Monitoring (`/admin/payments`)
* **Table Columns**: Payment ID, Reference, Merchant Name, Amount & Currency, Payment Type (`DEPOSIT`, `PAYOUT`, `REFUND`), Provider, Status, Created At, Actions.
* **Search & Filters**: Search by reference or ID; filter by merchant, status, provider, and date range.
* **Payment Details Drawer**:
  * Summary banner with status pill and amount.
  * Customer information (masked phone number e.g. `+255 71 ••• ••34`, country).
  * Provider transaction ID (`provider_payment_id`).
  * Status Timeline (`Created` → `Initiated` → `Processing` → `Completed`).
  * Failure diagnostics (if failed) showing `failure_reason` and error codes.
  * Metadata and related checkout session link.

### 5.5 Refund Management (`/admin/refunds`)
* **Operational Scope**: Reviews and processes payment refund requests.
* **Table Columns**: Refund ID, Original Payment Ref, Merchant, Amount, Reason, Status, Requested By, Approved By, Created Date.
* **Statuses**: `REQUESTED`, `UNDER_REVIEW`, `APPROVED`, `PROCESSING`, `COMPLETED`, `REJECTED`, `FAILED`.
* **Actions**:
  * **Approve Refund**: Confirmation dialog verifying merchant balance, original payment eligibility, and async provider processing notification.
  * **Reject Refund**: Mandatory rejection reason dialog.

### 5.6 Payout Management (`/admin/payouts`)
* **Table Columns**: Payout ID, Merchant, Recipient Phone/Account, Amount & Currency, Provider, Status, Created Date, Actions.
* **Statuses**: `PENDING`, `INITIATED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`.
* **Details Drawer**: Recipient details, provider status callback payload, and permission-restricted payout retry/cancellation triggers.

### 5.7 Checkout Sessions (`/admin/checkout-sessions`)
* **Table Columns**: Session ID, Merchant, Reference, Amount & Currency, Session Status, Payment Status, Created At, Expires At.
* **Lifecycle Traceability**:
  * Visual traceability tree linking `Merchant` → `Checkout Session` → `Payment Attempt` → `Provider Callback`.
  * Public token is masked (`tok_••••••••`).

### 5.8 Audit Logs & Diff Viewer (`/admin/audit-logs`)
* **Compliance Table**:
  * Columns: Timestamp (ISO + relative), Actor, Action (`MERCHANT_CREATED`, `API_KEY_ROTATED`, `MERCHANT_SUSPENDED`, `REFUND_APPROVED`, etc.), Resource Type, Resource ID, IP Address.
  * Filters: Date Range, Actor, Action, Resource Type.
* **Audit Diff Modal / Drawer**:
  * Request correlation ID, User Agent, IP Address.
  * **State Diff**: Side-by-side or unified green/red diff of `before` vs `after` state objects.
  * Automatic masking of sensitive fields (`apiKey`, `password`, `secret`, `token`).

### 5.9 Platform Settings & RBAC (`/admin/settings`)
* **Sections**:
  1. *Platform Configuration*: Service name, default currencies, timeout windows.
  2. *Provider Integration*: Pawapay environment status, active corridors, webhook endpoints.
  3. *Admin Users & RBAC*: Role definition matrix (Super Admin, Operations Admin, Finance Admin, Auditor, Support Agent).
  4. *Audit Retention*: Retention period and export compliance policies.

---

## 6. Roles & Permissions Architecture (RBAC)

The portal implements client-side role enforcement with the following permission matrix:

| Permission | Super Admin | Operations Admin | Finance Admin | Auditor | Support Agent |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `merchants.read` | Yes | Yes | Yes | Yes | Yes |
| `merchants.create` | Yes | Yes | No | No | No |
| `merchants.update` | Yes | Yes | No | No | No |
| `merchants.suspend` | Yes | Yes | No | No | No |
| `merchants.rotate_key` | Yes | Yes | No | No | No |
| `payments.read` | Yes | Yes | Yes | Yes | Yes |
| `payments.retry` | Yes | Yes | No | No | No |
| `refunds.read` | Yes | Yes | Yes | Yes | No |
| `refunds.approve` | Yes | No | Yes | No | No |
| `payouts.read` | Yes | Yes | Yes | Yes | No |
| `payouts.create` | Yes | No | Yes | No | No |
| `audit_logs.read` | Yes | Yes | Yes | Yes | No |
| `audit_logs.export` | Yes | No | No | Yes | No |
| `settings.update` | Yes | No | No | No | No |

---

## 7. Backend Integration & API Client Layer

### 7.1 Client Architecture (`frontend/lib/admin-api.ts`)
* Configured with base URL `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'`.
* Auto-injects `Admin-Api-Key` or `Authorization: Bearer <token>` from active admin session.
* **Live Integration**:
  * Fully wires up existing backend endpoints:
    * `GET /admin/applications` (List applications with pagination)
    * `POST /admin/applications` (Create new application)
    * `GET /admin/applications/:id` (Get application details)
    * `POST /admin/applications/:id/rotate-key` (Rotate API key)
    * `POST /admin/applications/:id/suspend` (Suspend application)
    * `POST /admin/applications/:id/reactivate` (Reactivate application)
* **Pending Endpoints Handling**:
  * For endpoints not yet implemented on the server (`/admin/payments`, `/admin/refunds`, `/admin/payouts`, `/admin/audit-logs`, `/admin/stats`), the API client intercepts 404/501 responses cleanly, rendering structured empty/pending states with explicit notices: *"Endpoint pending backend deployment / No active records found"*.

---

## 8. Verification & Acceptance Criteria

1. **Routing & Separation**: Navigating to `/admin` loads the protected Admin Portal with strict light-theme layout; navigating to `/checkout/[publicToken]` retains the public checkout layout and branding without regressions.
2. **Authentication Flow**: Navigating to `/admin` without credentials redirects to `/admin/login`. Signing in with valid admin credentials navigates to `/admin`.
3. **Live Merchant Operations**: Creating a merchant creates an actual row in the PostgreSQL database via `/api/v1/admin/applications`. Rotating keys, suspending, and reactivating updates live records. Display-once modal correctly reveals secret key.
4. **Data Density & Polish**: Monospace figures for all currency and identifiers. Responsive tables with horizontal scroll on smaller screens. No layout shifts during data loading.
5. **Security & Redaction**: Zero plaintext secret exposure in audit logs, diff views, or checkout tokens.
