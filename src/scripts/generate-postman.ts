import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load environment variables from .env if present
dotenv.config();

/**
 * Postman Collection v2.1.0 Type Definitions
 */
interface PostmanHeader {
  key: string;
  value: string;
  type?: string;
  description?: string;
}

interface PostmanUrl {
  raw: string;
  host: string[];
  path: string[];
  query?: Array<{
    key: string;
    value: string;
    description?: string;
    disabled?: boolean;
  }>;
}

interface PostmanRequestBody {
  mode: 'raw';
  raw: string;
  options?: {
    raw: {
      language: 'json';
    };
  };
}

interface PostmanEventScript {
  listen: 'prerequest' | 'test';
  script: {
    type: 'text/javascript';
    exec: string[];
  };
}

interface PostmanRequestItem {
  name: string;
  event?: PostmanEventScript[];
  request: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    header: PostmanHeader[];
    body?: PostmanRequestBody;
    url: PostmanUrl;
    description?: string;
  };
  response?: unknown[];
}

interface PostmanFolderItem {
  name: string;
  description?: string;
  item: (PostmanRequestItem | PostmanFolderItem)[];
}

interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
  description?: string;
}

interface PostmanCollection {
  info: {
    _postman_id: string;
    name: string;
    description: string;
    schema: string;
    version?: string;
  };
  variable: PostmanVariable[];
  item: (PostmanFolderItem | PostmanRequestItem)[];
}

interface PostmanEnvironment {
  id: string;
  name: string;
  values: Array<{
    key: string;
    value: string;
    type: string;
    enabled: boolean;
  }>;
  _postman_variable_scope: 'environment';
}

/**
 * Common test script snippets
 */
const STATUS_200_TEST = [
  'pm.test("Status code is 200 OK", function () {',
  '    pm.response.to.have.status(200);',
  '});',
  'pm.test("Response envelope is successful", function () {',
  '    const jsonData = pm.response.json();',
  '    pm.expect(jsonData.success).to.be.true;',
  '});'
];

const STATUS_201_TEST_AND_SAVE_APP = [
  'pm.test("Status code is 201 Created", function () {',
  '    pm.response.to.have.status(201);',
  '});',
  '',
  'const jsonData = pm.response.json();',
  'pm.test("Application successfully created with API key", function () {',
  '    pm.expect(jsonData.success).to.be.true;',
  '    pm.expect(jsonData.data).to.have.property("apiKey");',
  '});',
  '',
  '// Auto-populate collection and environment variables with new credentials',
  'if (jsonData.success && jsonData.data) {',
  '    if (jsonData.data.apiKey) {',
  '        pm.collectionVariables.set("api_key", jsonData.data.apiKey);',
  '        if (pm.environment) pm.environment.set("api_key", jsonData.data.apiKey);',
  '        console.info("⚡ Auto-filled api_key: " + jsonData.data.apiKey);',
  '    }',
  '    if (jsonData.data.application && jsonData.data.application.id) {',
  '        pm.collectionVariables.set("app_id", jsonData.data.application.id);',
  '        if (pm.environment) pm.environment.set("app_id", jsonData.data.application.id);',
  '        console.info("⚡ Auto-filled app_id: " + jsonData.data.application.id);',
  '    }',
  '    if (jsonData.data.webhookSecret) {',
  '        pm.collectionVariables.set("webhook_secret", jsonData.data.webhookSecret);',
  '        if (pm.environment) pm.environment.set("webhook_secret", jsonData.data.webhookSecret);',
  '    }',
  '}'
];

const STATUS_200_TEST_AND_SAVE_ROTATED_KEY = [
  'pm.test("Status code is 200 OK", function () {',
  '    pm.response.to.have.status(200);',
  '});',
  '',
  'const jsonData = pm.response.json();',
  'pm.test("API key rotated successfully", function () {',
  '    pm.expect(jsonData.success).to.be.true;',
  '    pm.expect(jsonData.data).to.have.property("apiKey");',
  '});',
  '',
  '// Auto-populate newly rotated API key into active variables',
  'if (jsonData.success && jsonData.data && jsonData.data.apiKey) {',
  '    pm.collectionVariables.set("api_key", jsonData.data.apiKey);',
  '    if (pm.environment) pm.environment.set("api_key", jsonData.data.apiKey);',
  '    console.info("⚡ Auto-updated rotated api_key: " + jsonData.data.apiKey);',
  '}'
];

const STATUS_200_APP_LIST_TEST = [
  'pm.test("Status code is 200 OK", function () {',
  '    pm.response.to.have.status(200);',
  '});',
  '',
  'const jsonData = pm.response.json();',
  'pm.test("Returns list of applications", function () {',
  '    pm.expect(jsonData.success).to.be.true;',
  '    pm.expect(Array.isArray(jsonData.data)).to.be.true;',
  '});',
  '',
  '// Auto-fill app_id from first item if not already set',
  'if (jsonData.success && Array.isArray(jsonData.data) && jsonData.data.length > 0) {',
  '    const currentAppId = pm.collectionVariables.get("app_id");',
  '    if (!currentAppId || currentAppId.includes("{{")) {',
  '        pm.collectionVariables.set("app_id", jsonData.data[0].id);',
  '        if (pm.environment) pm.environment.set("app_id", jsonData.data[0].id);',
  '        console.info("⚡ Auto-filled app_id from list: " + jsonData.data[0].id);',
  '    }',
  '}'
];

const STATUS_202_TEST_AND_SAVE_PAYMENT = [
  'pm.test("Status code is 202 Accepted", function () {',
  '    pm.response.to.have.status(202);',
  '});',
  '',
  'const jsonData = pm.response.json();',
  'pm.test("Deposit initiated successfully", function () {',
  '    pm.expect(jsonData.success).to.be.true;',
  '    pm.expect(jsonData.data).to.have.property("id");',
  '});',
  '',
  '// Auto-populate payment variables for subsequent lookup / webhook testing',
  'if (jsonData.success && jsonData.data) {',
  '    if (jsonData.data.id) {',
  '        pm.collectionVariables.set("payment_id", jsonData.data.id);',
  '        if (pm.environment) pm.environment.set("payment_id", jsonData.data.id);',
  '        console.info("⚡ Auto-filled payment_id: " + jsonData.data.id);',
  '    }',
  '    if (jsonData.data.reference) {',
  '        pm.collectionVariables.set("payment_reference", jsonData.data.reference);',
  '        if (pm.environment) pm.environment.set("payment_reference", jsonData.data.reference);',
  '        console.info("⚡ Auto-filled payment_reference: " + jsonData.data.reference);',
  '    }',
  '}'
];

const PAYMENT_LIST_TEST = [
  'pm.test("Status code is 200 OK", function () {',
  '    pm.response.to.have.status(200);',
  '});',
  '',
  'const jsonData = pm.response.json();',
  'pm.test("Returns paginated payment records", function () {',
  '    pm.expect(jsonData.success).to.be.true;',
  '    pm.expect(Array.isArray(jsonData.data)).to.be.true;',
  '    pm.expect(jsonData).to.have.property("meta");',
  '});',
  '',
  '// Auto-fill payment_id from latest payment if not yet populated',
  'if (jsonData.success && Array.isArray(jsonData.data) && jsonData.data.length > 0) {',
  '    const currentPaymentId = pm.collectionVariables.get("payment_id");',
  '    if (!currentPaymentId || currentPaymentId.includes("{{")) {',
  '        pm.collectionVariables.set("payment_id", jsonData.data[0].id);',
  '        if (pm.environment) pm.environment.set("payment_id", jsonData.data[0].id);',
  '        pm.collectionVariables.set("payment_reference", jsonData.data[0].reference);',
  '        if (pm.environment) pm.environment.set("payment_reference", jsonData.data[0].reference);',
  '        console.info("⚡ Auto-filled payment_id & reference from payment list");',
  '    }',
  '}'
];

const STATUS_202_TEST_AND_SAVE_PAYOUT = [
  'pm.test("Status code is 202 Accepted", function () {',
  '    pm.response.to.have.status(202);',
  '});',
  '',
  'const jsonData = pm.response.json();',
  'pm.test("Payout initiated successfully", function () {',
  '    pm.expect(jsonData.success).to.be.true;',
  '    pm.expect(jsonData.data).to.have.property("id");',
  '});',
  '',
  '// Auto-populate payout variables for subsequent lookup / webhook testing',
  'if (jsonData.success && jsonData.data) {',
  '    if (jsonData.data.id) {',
  '        pm.collectionVariables.set("payout_id", jsonData.data.id);',
  '        if (pm.environment) pm.environment.set("payout_id", jsonData.data.id);',
  '        console.info("⚡ Auto-filled payout_id: " + jsonData.data.id);',
  '    }',
  '    if (jsonData.data.reference) {',
  '        pm.collectionVariables.set("payout_reference", jsonData.data.reference);',
  '        if (pm.environment) pm.environment.set("payout_reference", jsonData.data.reference);',
  '        console.info("⚡ Auto-filled payout_reference: " + jsonData.data.reference);',
  '    }',
  '}'
];

const PAYOUT_LIST_TEST = [
  'pm.test("Status code is 200 OK", function () {',
  '    pm.response.to.have.status(200);',
  '});',
  '',
  'const jsonData = pm.response.json();',
  'pm.test("Returns paginated payout records", function () {',
  '    pm.expect(jsonData.success).to.be.true;',
  '    pm.expect(Array.isArray(jsonData.data)).to.be.true;',
  '    pm.expect(jsonData).to.have.property("meta");',
  '});',
  '',
  '// Auto-fill payout_id from latest payout if not yet populated',
  'if (jsonData.success && Array.isArray(jsonData.data) && jsonData.data.length > 0) {',
  '    const currentPayoutId = pm.collectionVariables.get("payout_id");',
  '    if (!currentPayoutId || currentPayoutId.includes("{{")) {',
  '        pm.collectionVariables.set("payout_id", jsonData.data[0].id);',
  '        if (pm.environment) pm.environment.set("payout_id", jsonData.data[0].id);',
  '        pm.collectionVariables.set("payout_reference", jsonData.data[0].reference);',
  '        if (pm.environment) pm.environment.set("payout_reference", jsonData.data[0].reference);',
  '        console.info("⚡ Auto-filled payout_id & reference from payout list");',
  '    }',
  '}'
];

const STATUS_202_TEST_AND_SAVE_REFUND = [
  'pm.test("Status code is 202 Accepted", function () {',
  '    pm.response.to.have.status(202);',
  '});',
  '',
  'const jsonData = pm.response.json();',
  'pm.test("Refund initiated successfully", function () {',
  '    pm.expect(jsonData.success).to.be.true;',
  '    pm.expect(jsonData.data).to.have.property("id");',
  '});',
  '',
  '// Auto-populate refund variables for subsequent lookup / webhook testing',
  'if (jsonData.success && jsonData.data) {',
  '    if (jsonData.data.id) {',
  '        pm.collectionVariables.set("refund_id", jsonData.data.id);',
  '        if (pm.environment) pm.environment.set("refund_id", jsonData.data.id);',
  '        console.info("⚡ Auto-filled refund_id: " + jsonData.data.id);',
  '    }',
  '    if (jsonData.data.reference) {',
  '        pm.collectionVariables.set("refund_reference", jsonData.data.reference);',
  '        if (pm.environment) pm.environment.set("refund_reference", jsonData.data.reference);',
  '        console.info("⚡ Auto-filled refund_reference: " + jsonData.data.reference);',
  '    }',
  '}'
];

const REFUND_LIST_TEST = [
  'pm.test("Status code is 200 OK", function () {',
  '    pm.response.to.have.status(200);',
  '});',
  '',
  'const jsonData = pm.response.json();',
  'pm.test("Returns paginated refund records", function () {',
  '    pm.expect(jsonData.success).to.be.true;',
  '    pm.expect(Array.isArray(jsonData.data)).to.be.true;',
  '    pm.expect(jsonData).to.have.property("meta");',
  '});',
  '',
  '// Auto-fill refund_id from latest refund if not yet populated',
  'if (jsonData.success && Array.isArray(jsonData.data) && jsonData.data.length > 0) {',
  '    const currentRefundId = pm.collectionVariables.get("refund_id");',
  '    if (!currentRefundId || currentRefundId.includes("{{")) {',
  '        pm.collectionVariables.set("refund_id", jsonData.data[0].id);',
  '        if (pm.environment) pm.environment.set("refund_id", jsonData.data[0].id);',
  '        pm.collectionVariables.set("refund_reference", jsonData.data[0].reference);',
  '        if (pm.environment) pm.environment.set("refund_reference", jsonData.data[0].reference);',
  '        console.info("⚡ Auto-filled refund_id & reference from refund list");',
  '    }',
  '}'
];

const STATUS_201_TEST_AND_SAVE_CHECKOUT = [
  'pm.test("Status code is 201 Created", function () {',
  '    pm.response.to.have.status(201);',
  '});',
  '',
  'const jsonData = pm.response.json();',
  'pm.test("Checkout session created successfully", function () {',
  '    pm.expect(jsonData.success).to.be.true;',
  '    pm.expect(jsonData.data).to.have.property("id");',
  '    pm.expect(jsonData.data).to.have.property("checkoutCode");',
  '});',
  '',
  '// Auto-populate checkout variables for subsequent lookup, expiry, or webhook testing',
  'if (jsonData.success && jsonData.data) {',
  '    if (jsonData.data.id) {',
  '        pm.collectionVariables.set("checkout_id", jsonData.data.id);',
  '        if (pm.environment) pm.environment.set("checkout_id", jsonData.data.id);',
  '        console.info("⚡ Auto-filled checkout_id: " + jsonData.data.id);',
  '    }',
  '    if (jsonData.data.checkoutCode) {',
  '        pm.collectionVariables.set("checkout_code", jsonData.data.checkoutCode);',
  '        if (pm.environment) pm.environment.set("checkout_code", jsonData.data.checkoutCode);',
  '        console.info("⚡ Auto-filled checkout_code: " + jsonData.data.checkoutCode);',
  '    }',
  '    if (jsonData.data.reference) {',
  '        pm.collectionVariables.set("checkout_reference", jsonData.data.reference);',
  '        if (pm.environment) pm.environment.set("checkout_reference", jsonData.data.reference);',
  '        console.info("⚡ Auto-filled checkout_reference: " + jsonData.data.reference);',
  '    }',
  '    if (jsonData.data.publicToken) {',
  '        pm.collectionVariables.set("checkout_public_token", jsonData.data.publicToken);',
  '        if (pm.environment) pm.environment.set("checkout_public_token", jsonData.data.publicToken);',
  '        console.info("⚡ Auto-filled checkout_public_token: " + jsonData.data.publicToken);',
  '    }',
  '    if (jsonData.data.checkoutUrl) {',
  '        pm.collectionVariables.set("checkout_url", jsonData.data.checkoutUrl);',
  '        if (pm.environment) pm.environment.set("checkout_url", jsonData.data.checkoutUrl);',
  '        console.info("⚡ Auto-filled checkout_url: " + jsonData.data.checkoutUrl);',
  '    }',
  '}'
];

const CHECKOUT_LIST_TEST = [
  'pm.test("Status code is 200 OK", function () {',
  '    pm.response.to.have.status(200);',
  '});',
  '',
  'const jsonData = pm.response.json();',
  'pm.test("Returns paginated checkout records", function () {',
  '    pm.expect(jsonData.success).to.be.true;',
  '    pm.expect(Array.isArray(jsonData.data)).to.be.true;',
  '    pm.expect(jsonData).to.have.property("meta");',
  '});',
  '',
  '// Auto-fill checkout variables from latest checkout item if not yet populated',
  'if (jsonData.success && Array.isArray(jsonData.data) && jsonData.data.length > 0) {',
  '    const currentCheckoutId = pm.collectionVariables.get("checkout_id");',
  '    if (!currentCheckoutId || currentCheckoutId.includes("{{")) {',
  '        pm.collectionVariables.set("checkout_id", jsonData.data[0].id);',
  '        if (pm.environment) pm.environment.set("checkout_id", jsonData.data[0].id);',
  '        pm.collectionVariables.set("checkout_code", jsonData.data[0].checkoutCode);',
  '        if (pm.environment) pm.environment.set("checkout_code", jsonData.data[0].checkoutCode);',
  '        pm.collectionVariables.set("checkout_reference", jsonData.data[0].reference);',
  '        if (pm.environment) pm.environment.set("checkout_reference", jsonData.data[0].reference);',
  '        console.info("⚡ Auto-filled checkout variables from checkout list");',
  '    }',
  '}'
];

const WEBHOOK_CALLBACK_TEST = [
  'pm.test("Status code is 200 OK", function () {',
  '    pm.response.to.have.status(200);',
  '});',
  '',
  'const jsonData = pm.response.json();',
  'pm.test("Webhook successfully processed and acknowledged", function () {',
  '    pm.expect(jsonData.success).to.be.true;',
  '    pm.expect(jsonData.data.acknowledged).to.be.true;',
  '});'
];

/**
 * Pre-request scripts for dynamic parameter generation
 */
const PREREQUEST_DYNAMIC_PAYMENT = [
  '// Auto-generate dynamic timestamp reference and idempotency key',
  'const timestamp = Date.now();',
  'pm.variables.set("req_reference", "ORDER-" + timestamp);',
  'pm.variables.set("req_idempotency_key", pm.variables.replaceIn("{{$guid}}"));'
];

const PREREQUEST_DYNAMIC_PAYOUT = [
  '// Auto-generate dynamic timestamp reference and idempotency key for payout',
  'const timestamp = Date.now();',
  'pm.variables.set("req_payout_reference", "PAYOUT-" + timestamp);',
  'pm.variables.set("req_idempotency_key", pm.variables.replaceIn("{{$guid}}"));'
];

const PREREQUEST_DYNAMIC_REFUND = [
  '// Auto-generate dynamic timestamp reference and idempotency key for refund',
  'const timestamp = Date.now();',
  'pm.variables.set("req_refund_reference", "REFUND-" + timestamp);',
  'pm.variables.set("req_idempotency_key", pm.variables.replaceIn("{{$guid}}"));',
  'const activeDepositId = pm.collectionVariables.get("payment_id") || pm.environment.get("payment_id");',
  'if (activeDepositId && !activeDepositId.includes("{{")) {',
  '    pm.variables.set("target_deposit_id", activeDepositId);',
  '} else {',
  '    pm.variables.set("target_deposit_id", pm.variables.replaceIn("{{$guid}}"));',
  '}'
];

const PREREQUEST_DYNAMIC_CHECKOUT = [
  '// Auto-generate dynamic timestamp reference and idempotency key for checkout',
  'const timestamp = Date.now();',
  'pm.variables.set("req_checkout_reference", "CHK-" + timestamp);',
  'pm.variables.set("req_idempotency_key", pm.variables.replaceIn("{{$guid}}"));'
];

const PREREQUEST_CREATE_APPLICATION = [
  '// Auto-generate unique slug per run to prevent collision',
  'const timestamp = Date.now();',
  'pm.variables.set("req_app_slug", "saas-app-" + timestamp);',
  'pm.variables.set("req_app_name", "SaaS Platform " + timestamp);'
];

const PREREQUEST_WEBHOOK_PAYLOAD = [
  '// Use existing payment_id or fallback to a fresh UUID',
  'const activeId = pm.collectionVariables.get("payment_id") || pm.environment.get("payment_id");',
  'if (activeId && !activeId.includes("{{")) {',
  '    pm.variables.set("webhook_deposit_id", activeId);',
  '} else {',
  '    pm.variables.set("webhook_deposit_id", pm.variables.replaceIn("{{$guid}}"));',
  '}'
];

const PREREQUEST_PAYOUT_WEBHOOK_PAYLOAD = [
  '// Use existing payout_id or fallback to a fresh UUID',
  'const activeId = pm.collectionVariables.get("payout_id") || pm.environment.get("payout_id");',
  'if (activeId && !activeId.includes("{{")) {',
  '    pm.variables.set("webhook_payout_id", activeId);',
  '} else {',
  '    pm.variables.set("webhook_payout_id", pm.variables.replaceIn("{{$guid}}"));',
  '}'
];

const PREREQUEST_REFUND_WEBHOOK_PAYLOAD = [
  '// Use existing refund_id and payment_id or fallback to a fresh UUID',
  'const activeRefundId = pm.collectionVariables.get("refund_id") || pm.environment.get("refund_id");',
  'if (activeRefundId && !activeRefundId.includes("{{")) {',
  '    pm.variables.set("webhook_refund_id", activeRefundId);',
  '} else {',
  '    pm.variables.set("webhook_refund_id", pm.variables.replaceIn("{{$guid}}"));',
  '}',
  'const activeDepositId = pm.collectionVariables.get("payment_id") || pm.environment.get("payment_id");',
  'if (activeDepositId && !activeDepositId.includes("{{")) {',
  '    pm.variables.set("webhook_deposit_id", activeDepositId);',
  '} else {',
  '    pm.variables.set("webhook_deposit_id", pm.variables.replaceIn("{{$guid}}"));',
  '}'
];

const PREREQUEST_CHECKOUT_WEBHOOK_PAYLOAD = [
  '// Use existing checkout_id or fallback to a fresh UUID',
  'const activeCheckoutId = pm.collectionVariables.get("checkout_id") || pm.environment.get("checkout_id");',
  'if (activeCheckoutId && !activeCheckoutId.includes("{{")) {',
  '    pm.variables.set("webhook_checkout_id", activeCheckoutId);',
  '} else {',
  '    pm.variables.set("webhook_checkout_id", pm.variables.replaceIn("{{$guid}}"));',
  '}',
  'const activeCode = pm.collectionVariables.get("checkout_code") || pm.environment.get("checkout_code");',
  'pm.variables.set("webhook_checkout_code", activeCode || "CHK-SIM-" + Date.now());'
];

/**
 * Builds the Postman collection
 */
export function buildPostmanCollection(options?: {
  baseUrl?: string;
  adminApiKey?: string;
  apiKey?: string;
}): PostmanCollection {
  const port = process.env.PORT || '5000';
  const defaultBaseUrl = options?.baseUrl || `http://localhost:${port}`;
  const defaultAdminApiKey =
    options?.adminApiKey ||
    process.env.ADMIN_API_KEY ||
    'admin_dev_secret_key_1234567890';
  const defaultApiKey = options?.apiKey || '';

  const collection: PostmanCollection = {
    info: {
      _postman_id: 'payment-service-collection-v1',
      name: 'Payment Service API',
      description:
        '# Reusable SaaS Payment Microservice Collection\n\n' +
        'This Postman Collection provides end-to-end testing for all payment service endpoints.\n\n' +
        '### ⚡ Automatic Variable & Token Population:\n' +
        '- **Admin Authentication**: Pre-configured with `{{admin_api_key}}` loaded from your `.env`.\n' +
        '- **Application Registration**: Running **Admin > Create Application** automatically extracts and sets `{{api_key}}`, `{{app_id}}`, and `{{webhook_secret}}` for all subsequent requests.\n' +
        '- **Deposit Orchestration**: Running **Deposits > Initiate Deposit** automatically generates dynamic references, unique UUID idempotency keys, and captures `{{payment_id}}` and `{{payment_reference}}`.\n' +
        '- **Payout Orchestration**: Running **Payouts > Initiate Payout** auto-generates references and captures `{{payout_id}}` and `{{payout_reference}}`.\n' +
        '- **Refunds Orchestration**: Running **Refunds > Initiate Refund** auto-links to `{{payment_id}}` and captures `{{refund_id}}` and `{{refund_reference}}`.\n' +
        '- **Checkouts Orchestration**: Running **Checkouts > Create Checkout Session** auto-captures `{{checkout_id}}`, `{{checkout_code}}`, and `{{checkout_reference}}`.\n' +
        '- **Webhooks**: Running **Webhooks > Pawapay Callbacks** automatically reuses active transaction IDs (`{{payment_id}}`, `{{payout_id}}`, `{{refund_id}}`, `{{checkout_id}}`).\n' +
        '- **Key Rotation**: Running **Admin > Rotate Key** automatically updates `{{api_key}}` seamlessly.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      version: '1.1.0'
    },
    variable: [
      {
        key: 'baseUrl',
        value: defaultBaseUrl,
        type: 'string',
        description: 'Payment Service root URL (e.g. http://localhost:5000 or ngrok tunnel URL)'
      },
      {
        key: 'admin_api_key',
        value: defaultAdminApiKey,
        type: 'string',
        description: 'Secret Admin API key used for managing tenant applications'
      },
      {
        key: 'api_key',
        value: defaultApiKey,
        type: 'string',
        description: 'Client tenant API key (auto-populated by Admin > Create Application or Rotate Key)'
      },
      {
        key: 'app_id',
        value: '',
        type: 'string',
        description: 'Application ID UUID (auto-populated by Create Application or List Applications)'
      },
      {
        key: 'webhook_secret',
        value: '',
        type: 'string',
        description: 'Tenant application webhook signing secret (auto-populated on creation)'
      },
      {
        key: 'payment_id',
        value: '',
        type: 'string',
        description: 'Deposit Payment ID UUID (auto-populated by Initiate Deposit)'
      },
      {
        key: 'payment_reference',
        value: '',
        type: 'string',
        description: 'Client deposit order reference (auto-populated by Initiate Deposit)'
      },
      {
        key: 'payout_id',
        value: '',
        type: 'string',
        description: 'Payout ID UUID (auto-populated by Initiate Payout)'
      },
      {
        key: 'payout_reference',
        value: '',
        type: 'string',
        description: 'Client payout reference (auto-populated by Initiate Payout)'
      },
      {
        key: 'refund_id',
        value: '',
        type: 'string',
        description: 'Refund ID UUID (auto-populated by Initiate Refund)'
      },
      {
        key: 'refund_reference',
        value: '',
        type: 'string',
        description: 'Client refund reference (auto-populated by Initiate Refund)'
      },
      {
        key: 'checkout_id',
        value: '',
        type: 'string',
        description: 'Checkout Session ID UUID (auto-populated by Create Checkout Session)'
      },
      {
        key: 'checkout_code',
        value: '',
        type: 'string',
        description: 'Checkout alphanumeric code (auto-populated by Create Checkout Session)'
      },
      {
        key: 'checkout_reference',
        value: '',
        type: 'string',
        description: 'Client checkout reference (auto-populated by Create Checkout Session)'
      },
      {
        key: 'idempotency_key',
        value: '',
        type: 'string',
        description: 'UUID Idempotency key for creation requests'
      },
      {
        key: 'pawapay_test_phone_vodacom',
        value: '+255763456789',
        type: 'string',
        description: 'Official PawaPay Sandbox Test Number - Vodacom Tanzania (Auto-Approve / COMPLETED)'
      },
      {
        key: 'pawapay_test_phone_airtel',
        value: '+255683456789',
        type: 'string',
        description: 'Official PawaPay Sandbox Test Number - Airtel Tanzania (Auto-Approve / COMPLETED)'
      },
      {
        key: 'pawapay_test_phone_tigo',
        value: '+255713456789',
        type: 'string',
        description: 'Official PawaPay Sandbox Test Number - Tigo / Yas Tanzania (Auto-Approve / COMPLETED)'
      },
      {
        key: 'pawapay_test_phone_halotel',
        value: '+255623456789',
        type: 'string',
        description: 'Official PawaPay Sandbox Test Number - Halotel Tanzania (Auto-Approve / COMPLETED)'
      },
      {
        key: 'pawapay_test_phone_fail',
        value: '+255760000001',
        type: 'string',
        description: 'Official PawaPay Sandbox Test Number - Insufficient Funds / Failure Simulation'
      }
    ],
    item: [
      // =========================================================================
      // 1. HEALTH & SYSTEM
      // =========================================================================
      {
        name: '1. Health & Diagnostics',
        description: 'Service health, readiness, and documentation endpoints',
        item: [
          {
            name: 'Service Liveness Check',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [],
              url: {
                raw: '{{baseUrl}}/health',
                host: ['{{baseUrl}}'],
                path: ['health']
              },
              description: 'Verifies the HTTP process is alive and returning 200 OK.'
            }
          },
          {
            name: 'Database Readiness Check',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: [
                    'pm.test("Status code is 200 OK", function () {',
                    '    pm.response.to.have.status(200);',
                    '});',
                    'const jsonData = pm.response.json();',
                    'pm.test("Database connectivity verified", function () {',
                    '    pm.expect(jsonData.status).to.eql("ready");',
                    '    pm.expect(jsonData.database).to.eql("connected");',
                    '});'
                  ]
                }
              }
            ],
            request: {
              method: 'GET',
              header: [],
              url: {
                raw: '{{baseUrl}}/health/ready',
                host: ['{{baseUrl}}'],
                path: ['health', 'ready']
              },
              description: 'Verifies PostgreSQL database connectivity and migration readiness.'
            }
          },
          {
            name: 'Interactive Swagger UI Documentation',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: [
                    'pm.test("Status code is 200 OK", function () {',
                    '    pm.response.to.have.status(200);',
                    '});'
                  ]
                }
              }
            ],
            request: {
              method: 'GET',
              header: [],
              url: {
                raw: '{{baseUrl}}/docs/',
                host: ['{{baseUrl}}'],
                path: ['docs', '']
              },
              description: 'Loads the rendered Swagger UI OpenAPI documentation.'
            }
          }
        ]
      },

      // =========================================================================
      // 2. ADMIN - APPLICATIONS MANAGEMENT
      // =========================================================================
      {
        name: '2. Admin - Applications',
        description: 'Multi-tenant SaaS application provisioning and API key lifecycle management',
        item: [
          {
            name: 'Create Application (Auto-fills API Key & App ID)',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_CREATE_APPLICATION
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_201_TEST_AND_SAVE_APP
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Admin-Api-Key',
                  value: '{{admin_api_key}}',
                  description: 'Required Admin API key from .env'
                },
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    name: '{{req_app_name}}',
                    slug: '{{req_app_slug}}',
                    description: 'Automated test tenant platform',
                    webhookUrl: 'https://webhook.site/test-endpoint'
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/admin/applications',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'admin', 'applications']
              },
              description:
                'Registers a new tenant application. Automatically captures the plaintext API key and ID to collection variables.'
            }
          },
          {
            name: 'List Applications',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_APP_LIST_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Admin-Api-Key',
                  value: '{{admin_api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/admin/applications?page=1&limit=20',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'admin', 'applications'],
                query: [
                  {
                    key: 'page',
                    value: '1',
                    description: 'Page index'
                  },
                  {
                    key: 'limit',
                    value: '20',
                    description: 'Items per page'
                  }
                ]
              },
              description: 'Lists all registered tenant applications with pagination.'
            }
          },
          {
            name: 'Get Application by ID',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Admin-Api-Key',
                  value: '{{admin_api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/admin/applications/{{app_id}}',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'admin', 'applications', '{{app_id}}']
              },
              description: 'Fetches details of an application using the {{app_id}} variable.'
            }
          },
          {
            name: 'Rotate Application Key (Auto-updates API Key)',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST_AND_SAVE_ROTATED_KEY
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Admin-Api-Key',
                  value: '{{admin_api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/admin/applications/{{app_id}}/rotate-key',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'admin', 'applications', '{{app_id}}', 'rotate-key']
              },
              description: 'Generates a new API key for the application and automatically replaces {{api_key}}.'
            }
          },
          {
            name: 'Suspend Application',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: [
                    'pm.test("Status code is 200 OK", function () {',
                    '    pm.response.to.have.status(200);',
                    '});',
                    'const jsonData = pm.response.json();',
                    'pm.test("Application status is SUSPENDED", function () {',
                    '    pm.expect(jsonData.data.status).to.eql("SUSPENDED");',
                    '});'
                  ]
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Admin-Api-Key',
                  value: '{{admin_api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/admin/applications/{{app_id}}/suspend',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'admin', 'applications', '{{app_id}}', 'suspend']
              },
              description: 'Suspends the tenant application, temporarily blocking payment initiation.'
            }
          },
          {
            name: 'Reactivate Application',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: [
                    'pm.test("Status code is 200 OK", function () {',
                    '    pm.response.to.have.status(200);',
                    '});',
                    'const jsonData = pm.response.json();',
                    'pm.test("Application status is ACTIVE", function () {',
                    '    pm.expect(jsonData.data.status).to.eql("ACTIVE");',
                    '});'
                  ]
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Admin-Api-Key',
                  value: '{{admin_api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/admin/applications/{{app_id}}/reactivate',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'admin', 'applications', '{{app_id}}', 'reactivate']
              },
              description: 'Reactivates a suspended tenant application back to ACTIVE status.'
            }
          }
        ]
      },

      // =========================================================================
      // 3. DEPOSITS API (TENANT CLIENT ENDPOINTS)
      // =========================================================================
      {
        name: '3. Deposits API',
        description: 'Mobile money deposit orchestration, querying, and idempotency handling',
        item: [
          {
            name: 'Initiate Deposit - Vodacom Tanzania (TZS)',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_DYNAMIC_PAYMENT
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_202_TEST_AND_SAVE_PAYMENT
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}',
                  description: 'Tenant Bearer API Key'
                },
                {
                  key: 'Idempotency-Key',
                  value: '{{req_idempotency_key}}',
                  description: 'Unique UUID key preventing double-charge'
                },
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    reference: '{{req_reference}}',
                    amount: 50000.0,
                    currency: 'TZS',
                    phoneNumber: '{{pawapay_test_phone_vodacom}}',
                    country: 'TZ',
                    provider: 'VODACOM_TZA',
                    description: 'Conference Registration Ticket #102',
                    metadata: {
                      ticketTier: 'VIP',
                      orderId: 'ORD-TZS-102'
                    }
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/payments',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payments']
              },
              description:
                'Initiates a mobile money STK push or deposit request in Tanzania. Auto-saves {{payment_id}} and {{payment_reference}}.'
            }
          },
          {
            name: 'Initiate Deposit - Airtel Tanzania (TZS)',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_DYNAMIC_PAYMENT
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_202_TEST_AND_SAVE_PAYMENT
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                },
                {
                  key: 'Idempotency-Key',
                  value: '{{req_idempotency_key}}'
                },
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    reference: '{{req_reference}}',
                    amount: 30000,
                    currency: 'TZS',
                    phoneNumber: '{{pawapay_test_phone_airtel}}',
                    country: 'TZ',
                    provider: 'AIRTEL_TZA',
                    description: 'Airtel Pro Subscription',
                    metadata: {
                      plan: 'Pro-Tier',
                      billingCycle: 'monthly'
                    }
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/payments',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payments']
              },
              description: 'Initiates a mobile money deposit using Airtel Tanzania (AIRTEL_TZA).'
            }
          },
          {
            name: 'Initiate Deposit - Yas (Tigo) Tanzania (TZS)',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_DYNAMIC_PAYMENT
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_202_TEST_AND_SAVE_PAYMENT
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                },
                {
                  key: 'Idempotency-Key',
                  value: '{{req_idempotency_key}}'
                },
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    reference: '{{req_reference}}',
                    amount: 20000,
                    currency: 'TZS',
                    phoneNumber: '{{pawapay_test_phone_tigo}}',
                    country: 'TZ',
                    provider: 'YAS_TZA',
                    description: 'Yas Store Checkout',
                    metadata: {
                      cartId: 'cart-yas-889'
                    }
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/payments',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payments']
              },
              description:
                'Initiates a mobile money deposit using Yas Tanzania (formerly Tigo). Accepts YAS_TZA, YAS, or TIGO_TZA.'
            }
          },
          {
            name: 'Initiate Deposit - Idempotency Replay Test',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: [
                    'pm.test("Idempotent response returned", function () {',
                    '    pm.expect([200, 202]).to.include(pm.response.code);',
                    '});',
                    'pm.test("Response contains same payment data", function () {',
                    '    const jsonData = pm.response.json();',
                    '    pm.expect(jsonData.success).to.be.true;',
                    '    pm.expect(jsonData.data.reference).to.eql("ORDER-IDEMPOTENCY-FIXED-TEST");',
                    '});'
                  ]
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                },
                {
                  key: 'Idempotency-Key',
                  value: 'idemp-fixed-test-uuid-99999999999'
                },
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    reference: 'ORDER-IDEMPOTENCY-FIXED-TEST',
                    amount: 10000.0,
                    currency: 'TZS',
                    phoneNumber: '{{pawapay_test_phone_vodacom}}',
                    country: 'TZ',
                    provider: 'VODACOM_TZA',
                    description: 'Idempotency Verification Check'
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/payments',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payments']
              },
              description:
                'Submits a payment with fixed reference and idempotency key twice to test safe replay without double charges.'
            }
          },
          {
            name: 'List Payments (Paginated)',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: PAYMENT_LIST_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/payments?page=1&limit=20',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payments'],
                query: [
                  {
                    key: 'page',
                    value: '1',
                    description: 'Page index'
                  },
                  {
                    key: 'limit',
                    value: '20',
                    description: 'Page size'
                  }
                ]
              },
              description: 'Retrieves a paginated list of payments for the authenticated tenant application.'
            }
          },
          {
            name: 'List Payments with Filter (Status)',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/payments?page=1&limit=10&status=PROCESSING',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payments'],
                query: [
                  {
                    key: 'page',
                    value: '1'
                  },
                  {
                    key: 'limit',
                    value: '10'
                  },
                  {
                    key: 'status',
                    value: 'PROCESSING',
                    description: 'Filter by: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED, EXPIRED'
                  }
                ]
              },
              description: 'Retrieves payments filtered by status.'
            }
          },
          {
            name: 'Get Payment by ID',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/payments/{{payment_id}}',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payments', '{{payment_id}}']
              },
              description: 'Retrieves an individual payment by UUID using the {{payment_id}} variable.'
            }
          },
          {
            name: 'Get Payment by Reference',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/payments/reference/{{payment_reference}}',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payments', 'reference', '{{payment_reference}}']
              },
              description: 'Retrieves payment details by client order reference ({{payment_reference}}).'
            }
          }
        ]
      },

      // =========================================================================
      // 4. PAYOUTS API (B2C DISBURSEMENTS)
      // =========================================================================
      {
        name: '4. Payouts API',
        description: 'B2C mobile money payouts and disbursements across multi-country providers',
        item: [
          {
            name: 'Initiate Payout - Vodacom Tanzania (TZS)',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_DYNAMIC_PAYOUT
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_202_TEST_AND_SAVE_PAYOUT
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}',
                  description: 'Tenant Bearer API Key'
                },
                {
                  key: 'Idempotency-Key',
                  value: '{{req_idempotency_key}}',
                  description: 'Unique UUID key preventing duplicate disbursement'
                },
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    reference: '{{req_payout_reference}}',
                    amount: 25000.0,
                    currency: 'TZS',
                    phoneNumber: '{{pawapay_test_phone_vodacom}}',
                    country: 'TZ',
                    provider: 'VODACOM_TZA',
                    customerMessage: 'Withdrawal payout',
                    description: 'Vendor monthly settlement',
                    metadata: {
                      recipientType: 'vendor',
                      vendorId: 'V-994'
                    }
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/payouts',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payouts']
              },
              description:
                'Initiates a B2C mobile money payout in Tanzania. Auto-saves {{payout_id}} and {{payout_reference}}.'
            }
          },
          {
            name: 'Initiate Payout - Airtel Tanzania (TZS)',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_DYNAMIC_PAYOUT
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_202_TEST_AND_SAVE_PAYOUT
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                },
                {
                  key: 'Idempotency-Key',
                  value: '{{req_idempotency_key}}'
                },
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    reference: '{{req_payout_reference}}',
                    amount: 15000.0,
                    currency: 'TZS',
                    phoneNumber: '{{pawapay_test_phone_airtel}}',
                    country: 'TZ',
                    provider: 'AIRTEL_TZA',
                    customerMessage: 'Cashback bonus',
                    description: 'User referral reward'
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/payouts',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payouts']
              },
              description: 'Initiates a B2C payout to Airtel Tanzania subscriber.'
            }
          },
          {
            name: 'Initiate Payout - MTN Uganda (UGX Multi-Country)',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_DYNAMIC_PAYOUT
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_202_TEST_AND_SAVE_PAYOUT
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                },
                {
                  key: 'Idempotency-Key',
                  value: '{{req_idempotency_key}}'
                },
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    reference: '{{req_payout_reference}}',
                    amount: 50000.0,
                    currency: 'UGX',
                    phoneNumber: '+256772123456',
                    country: 'UG',
                    provider: 'MTN_MOM_UGA',
                    customerMessage: 'Regional payout',
                    description: 'Cross-border contractor payment'
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/payouts',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payouts']
              },
              description: 'Demonstrates multi-country payout capability (Uganda MTN).'
            }
          },
          {
            name: 'List Payouts (Paginated)',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: PAYOUT_LIST_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/payouts?page=1&limit=20',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payouts'],
                query: [
                  {
                    key: 'page',
                    value: '1',
                    description: 'Page index'
                  },
                  {
                    key: 'limit',
                    value: '20',
                    description: 'Page size'
                  }
                ]
              },
              description: 'Retrieves a paginated list of payouts for the authenticated tenant.'
            }
          },
          {
            name: 'List Payouts with Filter (Status)',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/payouts?page=1&limit=10&status=PROCESSING',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payouts'],
                query: [
                  {
                    key: 'page',
                    value: '1'
                  },
                  {
                    key: 'limit',
                    value: '10'
                  },
                  {
                    key: 'status',
                    value: 'PROCESSING',
                    description: 'Filter by: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED'
                  }
                ]
              },
              description: 'Retrieves payouts filtered by status.'
            }
          },
          {
            name: 'Get Payout by ID',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/payouts/{{payout_id}}',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payouts', '{{payout_id}}']
              },
              description: 'Retrieves payout details by UUID using {{payout_id}}.'
            }
          },
          {
            name: 'Get Payout by Reference',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/payouts/reference/{{payout_reference}}',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'payouts', 'reference', '{{payout_reference}}']
              },
              description: 'Retrieves payout details by client reference ({{payout_reference}}).'
            }
          }
        ]
      },

      // =========================================================================
      // 5. REFUNDS API
      // =========================================================================
      {
        name: '5. Refunds API',
        description: 'Partial and full deposit refunds linked to original deposits',
        item: [
          {
            name: 'Initiate Refund for Deposit',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_DYNAMIC_REFUND
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_202_TEST_AND_SAVE_REFUND
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}',
                  description: 'Tenant Bearer API Key'
                },
                {
                  key: 'Idempotency-Key',
                  value: '{{req_idempotency_key}}',
                  description: 'Unique UUID key preventing duplicate refunds'
                },
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    depositPaymentId: '{{target_deposit_id}}',
                    reference: '{{req_refund_reference}}',
                    amount: 10000.0,
                    currency: 'TZS',
                    description: 'Partial refund for damaged goods',
                    metadata: {
                      ticketId: 'SUPP-848',
                      reasonCode: 'DAMAGED_ITEM'
                    }
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/refunds',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'refunds']
              },
              description:
                'Initiates a refund for an existing deposit. Automatically captures {{refund_id}} and {{refund_reference}}.'
            }
          },
          {
            name: 'List Refunds (Paginated)',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: REFUND_LIST_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/refunds?page=1&limit=20',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'refunds'],
                query: [
                  {
                    key: 'page',
                    value: '1'
                  },
                  {
                    key: 'limit',
                    value: '20'
                  }
                ]
              },
              description: 'Retrieves a paginated list of refunds.'
            }
          },
          {
            name: 'List Refunds for Specific Deposit',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/refunds?originalPaymentId={{payment_id}}',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'refunds'],
                query: [
                  {
                    key: 'originalPaymentId',
                    value: '{{payment_id}}',
                    description: 'UUID of the original deposit'
                  }
                ]
              },
              description: 'Lists all refunds associated with the active {{payment_id}}.'
            }
          },
          {
            name: 'Get Refund by ID',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/refunds/{{refund_id}}',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'refunds', '{{refund_id}}']
              },
              description: 'Retrieves refund details using the {{refund_id}} variable.'
            }
          },
          {
            name: 'Get Refund by Reference',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/refunds/reference/{{refund_reference}}',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'refunds', 'reference', '{{refund_reference}}']
              },
              description: 'Retrieves refund details by client refund reference ({{refund_reference}}).'
            }
          }
        ]
      },

      // =========================================================================
      // 6. CHECKOUTS API (HOSTED CHECKOUT SESSIONS)
      // =========================================================================
      {
        name: '6. Checkouts API',
        description: 'Hosted payment checkout sessions, codes, and lifecycle expiration',
        item: [
          {
            name: 'Create Hosted Checkout Session',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_DYNAMIC_CHECKOUT
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_201_TEST_AND_SAVE_CHECKOUT
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}',
                  description: 'Tenant Bearer API Key'
                },
                {
                  key: 'Idempotency-Key',
                  value: '{{req_idempotency_key}}',
                  description: 'Unique UUID key preventing duplicate session creation'
                },
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    reference: '{{req_checkout_reference}}',
                    returnUrl: 'https://merchant.example.com/checkout/complete',
                    returnMethod: 'INSTANT',
                    defaultLanguage: 'en',
                    amounts: [
                      {
                        country: 'TZ',
                        currency: 'TZS',
                        amount: 50000
                      }
                    ],
                    payer: {
                      phoneNumber: '{{pawapay_test_phone_vodacom}}',
                      allowCustomerToOverride: true
                    },
                    reason: {
                      en: 'Order payment'
                    },
                    expiresAfter: 15,
                    metadata: {
                      cartId: 'cart_9934',
                      platform: 'web_portal',
                      orderId: 'ORD-CHK-2026-99'
                    }
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/checkouts',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'checkouts']
              },
              description:
                'Creates a hosted checkout session with Pawapay. Captures {{checkout_id}}, {{checkout_code}}, and {{checkout_reference}}.'
            }
          },
          {
            name: 'List Checkouts (Paginated)',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: CHECKOUT_LIST_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/checkouts?page=1&limit=20',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'checkouts'],
                query: [
                  {
                    key: 'page',
                    value: '1'
                  },
                  {
                    key: 'limit',
                    value: '20'
                  }
                ]
              },
              description: 'Retrieves a paginated list of checkout sessions.'
            }
          },
          {
            name: 'List Checkouts with Filter (Status)',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/checkouts?page=1&limit=10&status=PENDING',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'checkouts'],
                query: [
                  {
                    key: 'page',
                    value: '1'
                  },
                  {
                    key: 'limit',
                    value: '10'
                  },
                  {
                    key: 'status',
                    value: 'PENDING',
                    description: 'Filter by: PENDING, COMPLETED, FAILED, EXPIRED, CANCELLED'
                  }
                ]
              },
              description: 'Retrieves checkouts filtered by status.'
            }
          },
          {
            name: 'Get Checkout by ID',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/checkouts/{{checkout_id}}',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'checkouts', '{{checkout_id}}']
              },
              description: 'Retrieves checkout session details using {{checkout_id}}.'
            }
          },
          {
            name: 'Get Checkout by Code',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/checkouts/code/{{checkout_code}}',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'checkouts', 'code', '{{checkout_code}}']
              },
              description: 'Retrieves checkout session details using alphanumeric code {{checkout_code}}.'
            }
          },
          {
            name: 'Expire Checkout Session',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{api_key}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/checkouts/{{checkout_id}}/expire',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'checkouts', '{{checkout_id}}', 'expire']
              },
              description: 'Manually expires an active checkout session.'
            }
          },
          {
            name: 'Get Public Checkout Session (Hosted Frontend)',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Accept',
                  value: 'application/json'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/checkouts/public/{{checkout_public_token}}',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'checkouts', 'public', '{{checkout_public_token}}']
              },
              description: 'Public endpoint used by Next.js checkout frontend to fetch sanitized session details without API key.'
            }
          },
          {
            name: 'Initiate Mobile Money Payment (Hosted Frontend)',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    provider: 'VODACOM_TZA',
                    customerPhone: '+255754123456',
                    customerName: 'Alice Smith',
                    customerEmail: 'alice@example.com'
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/checkouts/public/{{checkout_public_token}}/pay',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'checkouts', 'public', '{{checkout_public_token}}', 'pay']
              },
              description: 'Customer initiates mobile money payment. Triggers backend Pawapay deposit and transitions checkout to PROCESSING.'
            }
          },
          {
            name: 'Get Public Checkout Status (Frontend Polling)',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Accept',
                  value: 'application/json'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/checkouts/public/{{checkout_public_token}}/status',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'checkouts', 'public', '{{checkout_public_token}}', 'status']
              },
              description: 'Lightweight polling endpoint returning the latest checkout status (e.g. PROCESSING, COMPLETED, FAILED).'
            }
          },
          {
            name: 'Cancel Public Checkout Session (Hosted Frontend)',
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: STATUS_200_TEST
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Accept',
                  value: 'application/json'
                }
              ],
              url: {
                raw: '{{baseUrl}}/api/v1/checkouts/public/{{checkout_public_token}}/cancel',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'checkouts', 'public', '{{checkout_public_token}}', 'cancel']
              },
              description: 'Allows customer to cancel a pending checkout session.'
            }
          }
        ]
      },

      // =========================================================================
      // 7. WEBHOOKS (ASYNC PROVIDER INGESTION)
      // =========================================================================
      {
        name: '7. Webhooks',
        description: 'Simulate asynchronous callbacks from Pawapay for deposits, payouts, refunds, and checkouts',
        item: [
          {
            name: 'Pawapay Deposit Callback - COMPLETED Status',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_WEBHOOK_PAYLOAD
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: WEBHOOK_CALLBACK_TEST
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    depositId: '{{webhook_deposit_id}}',
                    status: 'COMPLETED',
                    requestedAmount: '50000.00',
                    amount: '50000.00',
                    currency: 'TZS',
                    country: 'TZ',
                    providerTransactionId: 'ptx_live_simulation_{{$timestamp}}',
                    payer: {
                      type: 'MMO',
                      accountDetails: {
                        phoneNumber: '+255796389143',
                        provider: 'VODACOM_TZA'
                      }
                    }
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/webhooks/pawapay',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'webhooks', 'pawapay']
              },
              description:
                'Simulates a successful asynchronous callback from Pawapay. Automatically resolves {{payment_id}} as the depositId.'
            }
          },
          {
            name: 'Pawapay Deposit Callback - FAILED Status',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_WEBHOOK_PAYLOAD
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: WEBHOOK_CALLBACK_TEST
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    depositId: '{{webhook_deposit_id}}',
                    status: 'FAILED',
                    requestedAmount: '50000.00',
                    currency: 'TZS',
                    country: 'TZ',
                    failureReason: {
                      code: 'INSUFFICIENT_FUNDS',
                      failureMessage: 'Subscriber does not have sufficient mobile money balance.'
                    }
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/webhooks/pawapay',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'webhooks', 'pawapay']
              },
              description: 'Simulates a failed asynchronous payment callback with failure reason details.'
            }
          },
          {
            name: 'Pawapay Payout Callback - COMPLETED Status',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_PAYOUT_WEBHOOK_PAYLOAD
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: WEBHOOK_CALLBACK_TEST
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    payoutId: '{{webhook_payout_id}}',
                    status: 'COMPLETED',
                    amount: '25000.00',
                    currency: 'TZS',
                    recipient: {
                      type: 'MMO',
                      accountDetails: {
                        phoneNumber: '+255796389143',
                        provider: 'VODACOM_TZA'
                      }
                    },
                    providerTransactionId: 'ptx_payout_sim_{{$timestamp}}'
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/webhooks/pawapay/payouts',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'webhooks', 'pawapay', 'payouts']
              },
              description:
                'Simulates a successful asynchronous payout callback from Pawapay. Automatically resolves {{payout_id}}.'
            }
          },
          {
            name: 'Pawapay Payout Callback - FAILED Status',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_PAYOUT_WEBHOOK_PAYLOAD
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: WEBHOOK_CALLBACK_TEST
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    payoutId: '{{webhook_payout_id}}',
                    status: 'FAILED',
                    amount: '25000.00',
                    currency: 'TZS',
                    failureReason: {
                      code: 'ACCOUNT_BARRED',
                      failureMessage: 'Recipient account is barred from receiving payouts.'
                    }
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/webhooks/pawapay/payouts',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'webhooks', 'pawapay', 'payouts']
              },
              description: 'Simulates a failed asynchronous payout callback with failure details.'
            }
          },
          {
            name: 'Pawapay Refund Callback - COMPLETED Status',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_REFUND_WEBHOOK_PAYLOAD
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: WEBHOOK_CALLBACK_TEST
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    refundId: '{{webhook_refund_id}}',
                    depositId: '{{webhook_deposit_id}}',
                    status: 'COMPLETED',
                    amount: '10000.00',
                    currency: 'TZS'
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/webhooks/pawapay/refunds',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'webhooks', 'pawapay', 'refunds']
              },
              description:
                'Simulates a successful asynchronous refund callback. Automatically resolves {{refund_id}} and {{payment_id}}.'
            }
          },
          {
            name: 'Pawapay Refund Callback - FAILED Status',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_REFUND_WEBHOOK_PAYLOAD
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: WEBHOOK_CALLBACK_TEST
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    refundId: '{{webhook_refund_id}}',
                    depositId: '{{webhook_deposit_id}}',
                    status: 'FAILED',
                    amount: '10000.00',
                    currency: 'TZS',
                    failureReason: {
                      code: 'EXCEEDS_ORIGINAL_AMOUNT',
                      failureMessage: 'Refund amount exceeds refundable balance.'
                    }
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/webhooks/pawapay/refunds',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'webhooks', 'pawapay', 'refunds']
              },
              description: 'Simulates a failed asynchronous refund callback.'
            }
          },
          {
            name: 'Pawapay Checkout Callback - COMPLETED Status',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_CHECKOUT_WEBHOOK_PAYLOAD
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: WEBHOOK_CALLBACK_TEST
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    checkoutId: '{{webhook_checkout_id}}',
                    status: 'COMPLETED',
                    checkoutCode: '{{webhook_checkout_code}}',
                    deposit: {
                      depositId: '{{$guid}}',
                      status: 'COMPLETED',
                      amount: '50000.00',
                      currency: 'TZS'
                    }
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/webhooks/pawapay/checkouts',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'webhooks', 'pawapay', 'checkouts']
              },
              description:
                'Simulates a successful asynchronous checkout callback. Automatically resolves {{checkout_id}}.'
            }
          },
          {
            name: 'Pawapay Checkout Callback - EXPIRED Status',
            event: [
              {
                listen: 'prerequest',
                script: {
                  type: 'text/javascript',
                  exec: PREREQUEST_CHECKOUT_WEBHOOK_PAYLOAD
                }
              },
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: WEBHOOK_CALLBACK_TEST
                }
              }
            ],
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify(
                  {
                    checkoutId: '{{webhook_checkout_id}}',
                    status: 'EXPIRED',
                    checkoutCode: '{{webhook_checkout_code}}',
                    failureReason: {
                      code: 'SESSION_EXPIRED',
                      failureMessage: 'Checkout session timed out before payment was completed.'
                    }
                  },
                  null,
                  2
                ),
                options: {
                  raw: {
                    language: 'json'
                  }
                }
              },
              url: {
                raw: '{{baseUrl}}/api/v1/webhooks/pawapay/checkouts',
                host: ['{{baseUrl}}'],
                path: ['api', 'v1', 'webhooks', 'pawapay', 'checkouts']
              },
              description: 'Simulates an expired asynchronous checkout callback.'
            }
          }
        ]
      }
    ]
  };

  return collection;
}

/**
 * Builds the corresponding Postman Environment
 */
export function buildPostmanEnvironment(options?: {
  baseUrl?: string;
  adminApiKey?: string;
  apiKey?: string;
}): PostmanEnvironment {
  const port = process.env.PORT || '5000';
  const defaultBaseUrl = options?.baseUrl || `http://localhost:${port}`;
  const defaultAdminApiKey =
    options?.adminApiKey ||
    process.env.ADMIN_API_KEY ||
    'admin_dev_secret_key_1234567890';
  const defaultApiKey = options?.apiKey || '';

  return {
    id: 'payment-service-local-env',
    name: 'Payment Service (Local Development)',
    values: [
      {
        key: 'baseUrl',
        value: defaultBaseUrl,
        type: 'default',
        enabled: true
      },
      {
        key: 'admin_api_key',
        value: defaultAdminApiKey,
        type: 'secret',
        enabled: true
      },
      {
        key: 'api_key',
        value: defaultApiKey,
        type: 'secret',
        enabled: true
      },
      {
        key: 'app_id',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'webhook_secret',
        value: '',
        type: 'secret',
        enabled: true
      },
      {
        key: 'payment_id',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'payment_reference',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'payout_id',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'payout_reference',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'refund_id',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'refund_reference',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'checkout_id',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'checkout_code',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'checkout_reference',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'checkout_public_token',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'checkout_url',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'idempotency_key',
        value: '',
        type: 'default',
        enabled: true
      },
      {
        key: 'pawapay_test_phone_vodacom',
        value: '+255763456789',
        type: 'default',
        enabled: true
      },
      {
        key: 'pawapay_test_phone_airtel',
        value: '+255683456789',
        type: 'default',
        enabled: true
      },
      {
        key: 'pawapay_test_phone_tigo',
        value: '+255713456789',
        type: 'default',
        enabled: true
      },
      {
        key: 'pawapay_test_phone_halotel',
        value: '+255623456789',
        type: 'default',
        enabled: true
      },
      {
        key: 'pawapay_test_phone_fail',
        value: '+255760000001',
        type: 'default',
        enabled: true
      }
    ],
    _postman_variable_scope: 'environment'
  };
}

/**
 * Main execution handler
 */
export function generatePostmanFiles(targetDir?: string): {
  collectionPath: string;
  environmentPath: string;
} {
  const rootDir = process.cwd();
  const outputDirectory = targetDir ? path.resolve(rootDir, targetDir) : path.resolve(rootDir, 'docs');

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  const collection = buildPostmanCollection();
  const environment = buildPostmanEnvironment();

  const collectionPath = path.join(outputDirectory, 'payment-service.postman_collection.json');
  const environmentPath = path.join(outputDirectory, 'payment-service.postman_environment.json');

  fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2), 'utf8');
  fs.writeFileSync(environmentPath, JSON.stringify(environment, null, 2), 'utf8');

  // Also write a root copy if generating to docs/ so both docs and root are convenient
  const rootCollectionPath = path.join(rootDir, 'payment-service.postman_collection.json');
  const rootEnvironmentPath = path.join(rootDir, 'payment-service.postman_environment.json');
  fs.writeFileSync(rootCollectionPath, JSON.stringify(collection, null, 2), 'utf8');
  fs.writeFileSync(rootEnvironmentPath, JSON.stringify(environment, null, 2), 'utf8');

  return { collectionPath, environmentPath };
}

// Direct CLI Execution
const isDirectExecution =
  process.argv[1]?.includes('generate-postman') ||
  process.argv[1]?.endsWith('generate-postman.ts') ||
  process.argv[1]?.endsWith('generate-postman.js');

if (isDirectExecution) {
  try {
    const customDir = process.argv[2];
    const { collectionPath, environmentPath } = generatePostmanFiles(customDir);

    console.info('\n================================================================');
    console.info('🚀 Postman Collection & Environment Generated Successfully!');
    console.info('================================================================');
    console.info(`📁 Collection:  ${collectionPath}`);
    console.info(`📁 Environment: ${environmentPath}`);
    console.info(`📁 Root Copy:   ${path.resolve(process.cwd(), 'payment-service.postman_collection.json')}`);
    console.info('----------------------------------------------------------------');
    console.info('✨ Features & Automated Variable Auto-Population:');
    console.info('  1. Base URL defaults to http://localhost:' + (process.env.PORT || '5000'));
    console.info('  2. Admin-Api-Key is pre-filled from your active .env');
    console.info('  3. Executing "Admin > Create Application" auto-saves:');
    console.info('     - {{api_key}}, {{app_id}}, {{webhook_secret}}');
    console.info('  4. Executing "Deposits > Initiate Deposit" auto-generates:');
    console.info('     - Unique references, idempotency keys, auto-saves {{payment_id}}');
    console.info('  5. Executing "Payouts > Initiate Payout" auto-generates:');
    console.info('     - Dynamic references, UUID idempotency, auto-saves {{payout_id}}');
    console.info('  6. Executing "Refunds > Initiate Refund" auto-links:');
    console.info('     - Links active {{payment_id}}, auto-saves {{refund_id}}');
    console.info('  7. Executing "Checkouts > Create Checkout Session" auto-saves:');
    console.info('     - {{checkout_id}}, {{checkout_code}}, {{checkout_reference}}');
    console.info('  8. Executing "Webhooks > Pawapay Callbacks" auto-reuses:');
    console.info('     - Active {{payment_id}}, {{payout_id}}, {{refund_id}}, {{checkout_id}}');
    console.info('  9. Executing "Admin > Rotate Key" auto-updates {{api_key}}');
    console.info('================================================================\n');
  } catch (err) {
    console.error('❌ Failed to generate Postman files:', err);
    process.exit(1);
  }
}
