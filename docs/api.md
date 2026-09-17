# API Reference

The Payment Service provides a RESTful API over HTTPS with JSON request and response bodies.

## Base URL
```
http://localhost:5000/api/v1
```

## Standard Response Envelope

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable error description",
    "details": [ ... ]
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 1. Payments API (Client / Tenant Endpoints)

All payments endpoints require Bearer API key authentication:
```http
Authorization: Bearer pk_live_...
```

### 1.1 Initiate Deposit
Initiates a mobile-money deposit request.

- **Method**: `POST`
- **Path**: `/api/v1/payments`
- **Required Headers**:
  - `Authorization: Bearer <API_KEY>`
  - `Idempotency-Key: <UNIQUE_UUID_OR_STRING>`
  - `Content-Type: application/json`

#### Request Body
```json
{
  "reference": "ORDER-2026-991",
  "amount": 45000.00,
  "currency": "TZS",
  "phoneNumber": "+255700000000",
  "country": "TZ",
  "provider": "VODACOM_MOMO_TZA",
  "description": "Conference Pass #42",
  "metadata": {
    "orderId": "ord-42",
    "customerEmail": "attendee@reignova.com"
  }
}
```

#### Response (`202 Accepted`)
```json
{
  "success": true,
  "data": {
    "id": "7b8cb404-51e4-44b2-a4f6-86cb8114f4ee",
    "applicationId": "9d3108cf-6cad-4e9c-ac3c-c7cd4ad456d7",
    "reference": "ORDER-2026-991",
    "amount": 45000.00,
    "currency": "TZS",
    "phoneNumber": "+255700000000",
    "country": "TZ",
    "provider": "VODACOM_MOMO_TZA",
    "providerPaymentId": "7b8cb404-51e4-44b2-a4f6-86cb8114f4ee",
    "status": "PROCESSING",
    "description": "Conference Pass #42",
    "metadata": {
      "orderId": "ord-42",
      "customerEmail": "attendee@reignova.com"
    },
    "completedAt": null,
    "failedAt": null,
    "createdAt": "2026-09-17T18:00:00.000Z",
    "updatedAt": "2026-09-17T18:00:01.000Z"
  }
}
```

---

### 1.2 Get Payment by ID
Retrieves an individual payment. Scoped to the authenticated application.

- **Method**: `GET`
- **Path**: `/api/v1/payments/:id`
- **Headers**:
  - `Authorization: Bearer <API_KEY>`

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "7b8cb404-51e4-44b2-a4f6-86cb8114f4ee",
    "reference": "ORDER-2026-991",
    "amount": 45000.00,
    "currency": "TZS",
    "status": "COMPLETED",
    "completedAt": "2026-09-17T18:00:45.000Z",
    "createdAt": "2026-09-17T18:00:00.000Z"
  }
}
```

---

### 1.3 Get Payment by Reference
Retrieves a payment using the client's own order reference.

- **Method**: `GET`
- **Path**: `/api/v1/payments/reference/:reference`
- **Headers**:
  - `Authorization: Bearer <API_KEY>`

---

### 1.4 List Payments
Retrieves paginated payments for the authenticated application with optional filters.

- **Method**: `GET`
- **Path**: `/api/v1/payments?page=1&limit=20&status=COMPLETED&reference=ORDER-`
- **Query Parameters**:
  - `page`: integer (default: 1)
  - `limit`: integer (default: 20, max: 100)
  - `status`: string (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `EXPIRED`)
  - `reference`: string (partial match)
  - `phoneNumber`: string (partial match)
  - `startDate`: ISO 8601 Date
  - `endDate`: ISO 8601 Date

---

## 2. Webhooks API (Provider Ingestion)

### 2.1 Pawapay Webhook Endpoint
Receives status updates from Pawapay for deposits.

- **Method**: `POST`
- **Path**: `/api/v1/webhooks/pawapay`
- **Headers**:
  - `Content-Type: application/json`
  - `Signature: <RFC-9421_SIGNATURE>` (optional depending on configuration)
  - `Signature-Input: <RFC-9421_SIGNATURE_INPUT>`
  - `Content-Digest: <SHA256_DIGEST>`

#### Request Payload
```json
{
  "depositId": "7b8cb404-51e4-44b2-a4f6-86cb8114f4ee",
  "status": "COMPLETED",
  "requestedAmount": "45000.00",
  "amount": "45000.00",
  "currency": "TZS",
  "country": "TZA",
  "providerTransactionId": "ptx_998124912"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "acknowledged": true,
    "duplicate": false,
    "paymentId": "7b8cb404-51e4-44b2-a4f6-86cb8114f4ee",
    "status": "COMPLETED"
  }
}
```

---

## 3. Admin API (Platform Administration)

Protected by `Admin-Api-Key` header:
```http
Admin-Api-Key: <ADMIN_API_KEY>
```

### 3.1 Create Application
- **Method**: `POST`
- **Path**: `/api/v1/admin/applications`
- **Body**:
```json
{
  "name": "ReignovaEvents",
  "slug": "reignova-events",
  "description": "Ticketing Platform",
  "webhookUrl": "https://events.reignova.com/api/webhooks/payments"
}
```
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "application": { "id": "...", "name": "ReignovaEvents", "slug": "reignova-events" },
    "apiKey": "pk_live_f0a1b2c3...",
    "webhookSecret": "whsec_99a8b7c6..."
  }
}
```

### 3.2 Rotate Application API Key
- **Method**: `POST`
- **Path**: `/api/v1/admin/applications/:id/rotate-key`

### 3.3 Suspend / Reactivate Application
- **Method**: `POST`
- **Path**: `/api/v1/admin/applications/:id/suspend`
- **Path**: `/api/v1/admin/applications/:id/reactivate`

---

## 4. Health & Documentation

- `GET /health` — Simple health check (200 OK)
- `GET /health/ready` — Readiness check verifying database connectivity
- `GET /docs` — Interactive Swagger UI documentation
