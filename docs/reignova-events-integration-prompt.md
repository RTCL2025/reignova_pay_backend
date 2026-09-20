# Agent Prompt: Integrate Reignova Payment Service (Option A: Hosted Checkout) into Reignova Events Backend

<role>
You are a Senior Backend & Payments Infrastructure Engineer. Your task is to implement the end-to-end integration of Option A (Hosted Checkout UI) of the **Reignova Payment Microservice** into the **Reignova Events Backend** codebase.
</role>

<context>
Reignova Events is an event management and ticketing SaaS platform. The Reignova Payment Service (`https://pay.reignovatechnologies.com` or local `http://localhost:5000`) acts as an isolated, multi-tenant mobile money payment microservice.

Option A (Hosted Checkout) provides a secure, branded Next.js checkout experience where the buyer enters their mobile money number (+255 Vodacom, Airtel, Tigo/Yas, Halotel) and completes payment via USSD push prompts.

Your job is to implement the complete backend lifecycle in Reignova Events:
1. Creating checkout sessions via the Payment Microservice API (`POST /api/v1/checkouts`).
2. Receiving real-time, HMAC-SHA256-signed webhook callbacks (`POST /api/webhooks/payments`).
3. Handling customer return & fallback status verification endpoints.
4. Writing comprehensive unit and integration tests with mock fixtures.
</context>

<system_architecture>
```
+-----------------------------------------------------------------------------------+
|                            Reignova Events Backend (SaaS)                         |
|                                                                                   |
|  1. Customer creates Order -> POST /api/v1/orders                                 |
|  2. Calls Payment Service -> POST /api/v1/checkouts (Bearer API Key)              |
|  3. Receives checkoutUrl -> Returns checkoutUrl to client                         |
+-----------------------------------------------------------------------------------+
                                       |
                                       | Customer completes payment on Hosted UI
                                       v
+-----------------------------------------------------------------------------------+
|                            Payment Service & Webhook                              |
|                                                                                   |
|  - Hosted Checkout: https://pay.reignovatechnologies.com/checkout/cs_sec_...       |
|  - Handset receives USSD push prompt -> Customer enters PIN                       |
|  - Pawapay processes payment -> Webhook fires POST /api/webhooks/payments         |
+-----------------------------------------------------------------------------------+
                                       |
                                       | HMAC-SHA256 Signed Webhook POST
                                       v
+-----------------------------------------------------------------------------------+
|                            Reignova Events Webhook Handler                        |
|                                                                                   |
|  - Verifies X-Payment-Signature header using WEBHOOK_SECRET                       |
|  - Idempotently transitions Order to PAID and issues event tickets                 |
|  - Redirects customer upon returnUrl landing                                      |
+-----------------------------------------------------------------------------------+
```
</system_architecture>

<requirements>

### 1. Environment & Configuration Setup
Define and enforce the following environment variables in Reignova Events (`.env` and config module):
- `PAYMENT_SERVICE_BASE_URL`: Base URL of payment microservice (e.g., `http://localhost:5000/api/v1` or `https://pay.reignovatechnologies.com/api/v1`).
- `PAYMENT_SERVICE_API_KEY`: Tenant Bearer API Key (e.g., `pk_live_...`).
- `PAYMENT_SERVICE_WEBHOOK_SECRET`: HMAC signature verification secret (e.g., `whsec_...`).
- `REIGNOVA_EVENTS_BASE_URL`: Public base URL of Reignova Events (e.g., `https://events.reignova.com` or `http://localhost:4000`).

---

### 2. Implementation Steps

#### Step 2.1: Payment Service HTTP Client (`PaymentServiceClient`)
Create a dedicated client service encapsulating all HTTP calls to the Payment Service:
- **Base Endpoint**: `POST ${PAYMENT_SERVICE_BASE_URL}/checkouts`
- **Headers**:
  - `Authorization: Bearer ${PAYMENT_SERVICE_API_KEY}`
  - `Idempotency-Key: evt-order-${orderId}-${timestamp}`
  - `Content-Type: application/json`
- **Payload Structure**:
  ```json
  {
    "reference": "EVT-TICKET-${orderId}",
    "amount": 50000,
    "currency": "TZS",
    "country": "TZ",
    "description": "Reignova Events Order #${orderId}",
    "returnUrl": "${REIGNOVA_EVENTS_BASE_URL}/checkout/callback?reference=EVT-TICKET-${orderId}",
    "cancelUrl": "${REIGNOVA_EVENTS_BASE_URL}/checkout/cancel?reference=EVT-TICKET-${orderId}",
    "customer": {
      "name": "Customer Name",
      "email": "customer@example.com",
      "phoneNumber": "+255754123456"
    },
    "metadata": {
      "orderId": "ord_12345",
      "eventId": "evt_9921",
      "userId": "usr_771"
    }
  }
  ```
- Must implement retry logic for network timeouts and parse standard error envelope responses.

---

#### Step 2.2: Order Creation Controller & Checkout Session Initiate
Modify or create the Order Checkout API route in Reignova Events:
1. Create or retrieve `Order` in database in state `PENDING_PAYMENT`.
2. Invoke `PaymentServiceClient.createCheckoutSession(order)`.
3. Save `paymentCheckoutId` (`chk_...`) and `checkoutUrl` on the `Order` record.
4. Return `checkoutUrl` to the API client or issue a 302 redirect.

---

#### Step 2.3: Secure Webhook Receiver (`POST /api/webhooks/payments`)
Build a secure, idempotent webhook endpoint to receive payment state changes from the Payment Service:

##### Middleware: Preserve Raw Body
Ensure raw JSON body string is preserved before JSON parsing, required for exact HMAC digest calculation:
```typescript
import express from 'express';

app.use('/api/webhooks/payments', express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
```

##### Signature Verification Logic
Read header `X-Payment-Signature` (format: `t=<timestamp>,v1=<signature>`):
1. Extract `timestamp` (`t`) and `signature` (`v1`).
2. Construct signature payload: `${timestamp}.${rawBody}`.
3. Compute HMAC-SHA256 signature using `PAYMENT_SERVICE_WEBHOOK_SECRET`.
4. Perform constant-time timing safe comparison using `crypto.timingSafeEqual`.
5. Reject request with HTTP `401 Unauthorized` if signature is invalid or timestamp is older than 5 minutes.

##### Event Processing Logic
- Parse incoming webhook event payload:
  ```json
  {
    "event": "payment.completed",
    "timestamp": "2026-09-19T13:50:00.000Z",
    "data": {
      "paymentId": "pay_991823...",
      "reference": "EVT-TICKET-ORD-12345",
      "amount": 50000,
      "currency": "TZS",
      "status": "COMPLETED",
      "completedAt": "2026-09-19T13:50:00.000Z"
    }
  }
  ```
- **If `event === 'payment.completed'`**:
  - Atomically update Order status to `PAID`.
  - Issue tickets / QR codes for event attendees.
  - Send email notification to user.
- **If `event === 'payment.failed'`**:
  - Update Order status to `FAILED`.
  - Release reserved ticket inventory back to pool.
- **Idempotency**: Check if Order is already marked `PAID`. If so, acknowledge `200 OK` immediately without re-issuing tickets.

---

#### Step 2.4: Return URL Callback & Fallback Verification Handler
Create landing handler for `GET /checkout/callback`:
1. Receive query param `reference` (e.g. `EVT-TICKET-ORD-12345`).
2. Check local database for Order status.
3. **If Webhook not received yet**: Query Payment Service API directly:
   `GET ${PAYMENT_SERVICE_BASE_URL}/payments/reference/${reference}`
   with `Authorization: Bearer ${PAYMENT_SERVICE_API_KEY}`.
4. Update local database if status is `COMPLETED`.
5. Render order confirmation UI / ticket download link.

</requirements>

<code_templates>

### 1. Webhook Signature Verifier Utility (`src/utils/paymentSignature.ts`)
```typescript
import crypto from 'node:crypto';

export function verifyPaymentWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  if (!signatureHeader || !rawBody || !secret) return false;

  const parts = signatureHeader.split(',');
  const tPart = parts.find((p) => p.startsWith('t='));
  const v1Part = parts.find((p) => p.startsWith('v1='));

  if (!tPart || !v1Part) return false;

  const timestamp = tPart.split('=')[1];
  const signature = v1Part.split('=')[1];

  // Prevent replay attacks (5 minute threshold)
  const timestampMs = parseInt(timestamp, 10) * 1000;
  if (isNaN(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return false;
  }

  const payloadToSign = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadToSign)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}
```

### 2. Express Webhook Route (`src/routes/webhook.routes.ts`)
```typescript
import { Router, Request, Response } from 'express';
import { verifyPaymentWebhookSignature } from '../utils/paymentSignature.js';
import { orderService } from '../services/order.service.js';

const router = Router();

router.post(
  '/payments',
  async (req: Request & { rawBody?: string }, res: Response) => {
    try {
      const signatureHeader = req.headers['x-payment-signature'] as string;
      const secret = process.env.PAYMENT_SERVICE_WEBHOOK_SECRET!;

      if (!req.rawBody || !verifyPaymentWebhookSignature(req.rawBody, signatureHeader, secret)) {
        return res.status(401).json({ success: false, error: 'INVALID_SIGNATURE' });
      }

      const { event, data } = req.body;

      if (event === 'payment.completed') {
        await orderService.handlePaymentCompleted(data.reference, data);
      } else if (event === 'payment.failed') {
        await orderService.handlePaymentFailed(data.reference, data);
      }

      return res.status(200).json({ success: true, received: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
    }
  }
);

export default router;
```

</code_templates>

<verification_and_testing>

### Unit Tests
1. Test signature verifier with valid payload and secret -> returns `true`.
2. Test signature verifier with modified payload or wrong secret -> returns `false`.
3. Test expired timestamp signature -> returns `false`.

### Integration Testing with Local Payment Service
1. Launch local payment service (`pnpm dev:all`).
2. Start Ngrok tunnel for Reignova Events backend (`ngrok http 4000`).
3. Execute end-to-end checkout flow:
   - Initiate checkout session for test ticket.
   - Open generated `checkoutUrl` in browser.
   - Enter Vodacom test phone number (`+255754000000`).
   - Verify webhook arrives at local Reignova Events backend with clean signature verification (`200 OK`).
   - Confirm order transitions to `PAID` state and tickets are generated.

</verification_and_testing>
