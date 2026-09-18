# Reignova Hosted Checkout Frontend

Production-ready, branded Next.js 14 hosted checkout frontend for the **Reignova Payment Service** (`pay.reignovatechnologies.com`).

Designed to provide high-conversion, bank-grade mobile money checkout experiences across East Africa (Tanzania: Vodacom M-Pesa, Tigo Pesa, Airtel Money, Halotel HaloPesa), orchestrating direct carrier billing via Pawapay.

---

## 1. Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                            Merchant Platform (e.g. ReignovaEvents)                |
+-----------------------------------------------------------------------------------+
       | 1. POST /api/v1/checkouts (Bearer API Key)
       v
+-----------------------------------------------------------------------------------+
|                            Express Backend (src/)                                 |
| - Creates Checkout record in PostgreSQL                                           |
| - Generates cryptographically secure publicToken (`cs_sec_...`)                   |
| - Returns checkoutUrl: `https://pay.reignovatechnologies.com/checkout/cs_sec_...`  |
+-----------------------------------------------------------------------------------+
       |
       | 2. Redirects Customer / Opens Checkout Link
       v
+-----------------------------------------------------------------------------------+
|                            Next.js 14 App Router (frontend/)                      |
|                                                                                   |
|  [Checkout Header: Brand Emblem, Urgency Timer (15 min), Session Cancel]          |
|  [Merchant Summary: Brand Name, Verified Badge, Order Ref, Total Due]             |
|                                                                                   |
|  +-------------------------------------+  +------------------------------------+  |
|  |  CustomerDetailsForm                |  |  PaymentSummary                    |  |
|  |  - Carrier Auto-Detection Badge     |  |  - Order Subtotal & Free Fee       |  |
|  |  - M-Pesa / Tigo / Airtel / Halotel |  |  - 256-bit SSL Bank Security Badge |  |
|  |  - Mobile Number (+255)             |  |  - Instant Push USSD Guarantee     |  |
|  |  - Interactive "Pay TZS ..." CTA    |  +------------------------------------+  |
|  +-------------------------------------+                                          |
+-----------------------------------------------------------------------------------+
       | 3. POST /api/v1/checkouts/public/:publicToken/pay
       v
+-----------------------------------------------------------------------------------+
|                            Payment Processing Engine                              |
| - Backend initiates Pawapay Deposit                                               |
| - Handset receives instant USSD push popup prompt                                 |
| - Frontend transitions to <CheckoutProcessing /> (radar animation & instructions) |
| - Frontend polls GET /api/v1/checkouts/public/:publicToken/status every 2.5s      |
+-----------------------------------------------------------------------------------+
       | 4. Customer enters PIN -> Pawapay notifies Webhook Callback
       v
+-----------------------------------------------------------------------------------+
|                            Real-time Webhook Synchronization                      |
| - Webhook receives COMPLETED / FAILED event                                       |
| - Synchronizes Checkout state in DB and marks deposit complete                    |
| - Polling endpoint returns COMPLETED -> Frontend fires confetti celebration!      |
| - Automatically redirects customer to merchant returnUrl within 5 seconds         |
+-----------------------------------------------------------------------------------+
```

---

## 2. API Endpoints

### Private Merchant API (Server-to-Server)
Requires `Authorization: Bearer <API_KEY>` and optional `Idempotency-Key`.

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/checkouts` | Creates a new checkout session. Supports single-amount and multi-amount payloads. |
| `GET` | `/api/v1/checkouts` | Lists merchant checkout sessions (paginated, filterable by status). |
| `GET` | `/api/v1/checkouts/:id` | Retrieves full checkout session with internal metrics. |
| `GET` | `/api/v1/checkouts/code/:code` | Retrieves session by short alphanumeric checkout code. |
| `POST` | `/api/v1/checkouts/:id/expire` | Manually expires a checkout session. |

### Public Hosted Checkout API (No Secrets Exposed)
Protected by `publicRateLimiter` (60 requests/minute per IP).

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/checkouts/public/:publicToken` | Fetches sanitized session details (amount, currency, merchant name, logo, customer details, supported providers). Excludes internal IDs and merchant API secrets. |
| `POST` | `/api/v1/checkouts/public/:publicToken/pay` | Initiates mobile money payment with carrier push prompt. Transitions session to `PROCESSING`. |
| `GET` | `/api/v1/checkouts/public/:publicToken/status` | Lightweight endpoint polled by frontend every 2.5s to track terminal status. |
| `POST` | `/api/v1/checkouts/public/:publicToken/cancel` | Allows buyer to cancel an active checkout session. |

---

## 3. Session Lifecycle & State Machine

```
              +---------------------------+
              |   PENDING / WAITING_PAY   |
              +---------------------------+
                /           |           \
      Buyer Clicks     Buyer Submits     15 Min Inactivity
        "Cancel"        Valid Payment         Timeout
          /                 |                 \
         v                  v                  v
+--------------+    +---------------+    +-------------+
|  CANCELLED   |    |  PROCESSING   |    |   EXPIRED   |
+--------------+    +---------------+    +-------------+
                       /         \
              Pawapay Callback   Pawapay Callback
                (COMPLETED)          (FAILED)
                    /               \
                   v                 v
          +---------------+   +-------------+
          |   COMPLETED   |   |   FAILED    |
          +---------------+   +-------------+
```

---

## 4. Design System & Aesthetics

Implemented using Reignova Technologies' brand identity:
- **Navy Palette**: `#0F1A25` (Primary), `#16212F` (Card surface), `#1E2D3E` (Borders).
- **Accent Warm Amber/Gold**: `#F3A221` (Interactive primary), `#FFB74D` (Hover), `#D98A12` (Active).
- **Typography**: `Montserrat` (Headers, brand text) and `IBM Plex Mono` (Prices, references, timers).
- **Background**: Precision circuit traces pattern (`.circuit-pattern`) reflecting tech and financial orchestration infrastructure.
- **Glassmorphism**: Backdrop blur (`backdrop-filter: blur(16px)`), subtle border highlights, and soft accent glows.

---

## 5. Production Nginx Reverse Proxy Setup

On production servers hosting `pay.reignovatechnologies.com`, Nginx acts as a unified reverse proxy directing browser traffic to Next.js (`127.0.0.1:3000`) and API requests to Express (`127.0.0.1:5000`).

### Nginx Configuration File: `/etc/nginx/sites-available/pay.reignovatechnologies.com`

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=checkout_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name pay.reignovatechnologies.com;
    return 301 https://$host$request_uri;
}

# Production HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name pay.reignovatechnologies.com;

    # SSL Certificates (Let's Encrypt / Cloudflare)
    ssl_certificate /etc/letsencrypt/live/pay.reignovatechnologies.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pay.reignovatechnologies.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml font/woff2 image/svg+xml;

    # 1. API Reverse Proxy -> Express.js Backend (Port 5000)
    location /api/ {
        limit_req zone=api_limit burst=30 nodelay;

        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # 2. Next.js Static Optimization Chunks
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        expires 365d;
        access_log off;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 3. Next.js App Router -> Frontend Server (Port 3000)
    location / {
        limit_req zone=checkout_limit burst=20 nodelay;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

---

## 6. Development & Deployment Commands

```bash
# 1. Install all dependencies (root and frontend workspaces)
pnpm install

# 2. Start Backend API Dev Server (Port 5000)
pnpm dev

# 3. Start Next.js Checkout Frontend Dev Server (Port 3000)
pnpm dev:frontend

# 4. Run both concurrently
pnpm dev:all

# 5. Production Build
pnpm build            # Builds backend to dist/
pnpm build:frontend   # Builds Next.js to frontend/.next/

# 6. Run Test Suites
pnpm test             # Full unit & integration regression suite
pnpm test:integration # Integration endpoints including public checkouts
```
