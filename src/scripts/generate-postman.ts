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
        '- **Deposit Orchestration**: Running **Payments > Initiate Deposit** automatically generates dynamic references, unique UUID idempotency keys, and captures `{{payment_id}}` and `{{payment_reference}}`.\n' +
        '- **Webhooks**: Running **Webhooks > Pawapay Callback** automatically reuses the active `{{payment_id}}`.\n' +
        '- **Key Rotation**: Running **Admin > Rotate Key** automatically updates `{{api_key}}` seamlessly.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      version: '1.0.0'
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
        description: 'Payment ID UUID (auto-populated by Initiate Deposit)'
      },
      {
        key: 'payment_reference',
        value: '',
        type: 'string',
        description: 'Client order reference (auto-populated by Initiate Deposit)'
      },
      {
        key: 'idempotency_key',
        value: '',
        type: 'string',
        description: 'UUID Idempotency key for payment creation requests'
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
      // 3. PAYMENTS API (TENANT CLIENT ENDPOINTS)
      // =========================================================================
      {
        name: '3. Payments API',
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
                    phoneNumber: '+255796389143',
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
                    phoneNumber: '+255689956145',
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
                    phoneNumber: '+255707202098',
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
                    phoneNumber: '+255796389143',
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
      // 4. WEBHOOKS (ASYNC PROVIDER INGESTION)
      // =========================================================================
      {
        name: '4. Webhooks',
        description: 'Simulate asynchronous deposit status callbacks from Pawapay',
        item: [
          {
            name: 'Pawapay Callback - COMPLETED Status',
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
            name: 'Pawapay Callback - FAILED Status',
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
        key: 'idempotency_key',
        value: '',
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
  fs.writeFileSync(rootCollectionPath, JSON.stringify(collection, null, 2), 'utf8');

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
    console.info('     - {{api_key}}');
    console.info('     - {{app_id}}');
    console.info('     - {{webhook_secret}}');
    console.info('  4. Executing "Payments > Initiate Deposit" auto-generates:');
    console.info('     - Unique dynamic references and UUID idempotency keys');
    console.info('     - Auto-saves {{payment_id}} and {{payment_reference}}');
    console.info('  5. Executing "Webhooks > Pawapay Callback" auto-reuses:');
    console.info('     - Active {{payment_id}} as depositId');
    console.info('  6. Executing "Admin > Rotate Key" auto-updates {{api_key}}');
    console.info('================================================================\n');
  } catch (err) {
    console.error('❌ Failed to generate Postman files:', err);
    process.exit(1);
  }
}
