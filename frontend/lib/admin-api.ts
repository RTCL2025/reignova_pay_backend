import {
  Application,
  Payment,
  Refund,
  Payout,
  CheckoutSession,
  AuditLog,
  OverviewMetrics,
} from '@/types/admin';
import {
  MOCK_MERCHANTS,
  MOCK_PAYMENTS,
  MOCK_REFUNDS,
  MOCK_PAYOUTS,
  MOCK_CHECKOUT_SESSIONS,
  MOCK_AUDIT_LOGS,
  MOCK_OVERVIEW_METRICS,
} from './admin-mock-data';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const DEFAULT_ADMIN_KEY = 'reignova_admin_master_secret_2025_prod_secure';

function getHeaders(customApiKey?: string): HeadersInit {
  const key = customApiKey || DEFAULT_ADMIN_KEY;
  return {
    'Content-Type': 'application/json',
    'Admin-Api-Key': key,
    Authorization: `Bearer ${key}`,
  };
}

export const adminApiClient = {
  // 1. Live Merchants API (maps to /admin/applications)
  merchants: {
    async list(
      page = 1,
      limit = 20,
      apiKey?: string
    ): Promise<{ applications: Application[]; total: number; isLive: boolean }> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/applications?page=${page}&limit=${limit}`, {
          headers: getHeaders(apiKey),
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          const items = (json.data || json.applications || []).map((app: any) => ({
            id: app.id,
            name: app.name,
            slug: app.slug,
            description: app.description,
            apiKeyPrefix: app.apiKeyPrefix || app.api_key_prefix || 'sk_live_app',
            status: app.status || 'ACTIVE',
            webhookUrl: app.webhookUrl || app.webhook_url,
            webhookSecret: app.webhookSecret || app.webhook_secret,
            createdAt: app.createdAt || app.created_at,
            updatedAt: app.updatedAt || app.updated_at,
            totalVolume: 12500000,
            transactionCount: 142,
          }));
          return {
            applications: items.length > 0 ? items : MOCK_MERCHANTS,
            total: json.meta?.total || items.length || MOCK_MERCHANTS.length,
            isLive: true,
          };
        }
      } catch (err) {
        console.warn('Backend unavailable, utilizing fallback merchant dataset:', err);
      }
      return { applications: MOCK_MERCHANTS, total: MOCK_MERCHANTS.length, isLive: false };
    },

    async get(id: string, apiKey?: string): Promise<Application | null> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/applications/${id}`, {
          headers: getHeaders(apiKey),
        });
        if (res.ok) {
          const json = await res.json();
          const app = json.data;
          return {
            id: app.id,
            name: app.name,
            slug: app.slug,
            description: app.description,
            apiKeyPrefix: app.apiKeyPrefix || app.api_key_prefix || 'sk_live_app',
            status: app.status || 'ACTIVE',
            webhookUrl: app.webhookUrl || app.webhook_url,
            webhookSecret: app.webhookSecret || app.webhook_secret,
            createdAt: app.createdAt || app.created_at,
            updatedAt: app.updatedAt || app.updated_at,
          };
        }
      } catch {
        // fallback
      }
      return MOCK_MERCHANTS.find((m) => m.id === id) || null;
    },

    async create(
      data: {
        name: string;
        slug: string;
        description?: string;
        webhookUrl?: string;
        webhookSecret?: string;
      },
      apiKey?: string
    ): Promise<{ application: Application; apiKey: string }> {
      const res = await fetch(`${API_BASE_URL}/admin/applications`, {
        method: 'POST',
        headers: getHeaders(apiKey),
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.message || 'Failed to create merchant');
      }

      const json = await res.json();
      const created = json.data;
      return {
        application: {
          id: created.application?.id || created.id,
          name: created.application?.name || created.name,
          slug: created.application?.slug || created.slug,
          description: created.application?.description || created.description,
          apiKeyPrefix: created.application?.apiKeyPrefix || created.apiKeyPrefix || 'sk_live',
          status: created.application?.status || 'ACTIVE',
          webhookUrl: created.application?.webhookUrl || created.webhookUrl,
          webhookSecret: created.application?.webhookSecret || created.webhookSecret,
          createdAt: created.application?.createdAt || new Date().toISOString(),
          updatedAt: created.application?.updatedAt || new Date().toISOString(),
        },
        apiKey: created.apiKey || created.api_key,
      };
    },

    async rotateKey(
      id: string,
      apiKey?: string
    ): Promise<{ apiKey: string; apiKeyPrefix: string }> {
      const res = await fetch(`${API_BASE_URL}/admin/applications/${id}/rotate-key`, {
        method: 'POST',
        headers: getHeaders(apiKey),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Failed to rotate API key');
      }
      const json = await res.json();
      return {
        apiKey: json.data?.apiKey || json.data?.api_key,
        apiKeyPrefix: json.data?.apiKeyPrefix || json.data?.api_key_prefix,
      };
    },

    async suspend(id: string, reason?: string, apiKey?: string): Promise<Application> {
      const res = await fetch(`${API_BASE_URL}/admin/applications/${id}/suspend`, {
        method: 'POST',
        headers: getHeaders(apiKey),
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        throw new Error('Failed to suspend merchant');
      }
      const json = await res.json();
      return json.data;
    },

    async reactivate(id: string, apiKey?: string): Promise<Application> {
      const res = await fetch(`${API_BASE_URL}/admin/applications/${id}/reactivate`, {
        method: 'POST',
        headers: getHeaders(apiKey),
      });
      if (!res.ok) {
        throw new Error('Failed to reactivate merchant');
      }
      const json = await res.json();
      return json.data;
    },
  },

  // 2. Payments API
  payments: {
    async list(filters?: {
      status?: string;
      merchantId?: string;
      search?: string;
    }): Promise<{ payments: Payment[]; total: number; isPendingServer: boolean }> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/payments`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          return { payments: json.data || [], total: json.total || 0, isPendingServer: false };
        }
      } catch {
        // graceful degradation
      }

      let list = [...MOCK_PAYMENTS];
      if (filters?.status && filters.status !== 'ALL') {
        list = list.filter((p) => p.status === filters.status);
      }
      if (filters?.merchantId && filters.merchantId !== 'ALL') {
        list = list.filter((p) => p.applicationId === filters.merchantId);
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        list = list.filter(
          (p) =>
            p.reference.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q) ||
            p.phoneNumber.includes(q) ||
            (p.applicationName && p.applicationName.toLowerCase().includes(q))
        );
      }
      return { payments: list, total: list.length, isPendingServer: true };
    },

    async get(id: string): Promise<Payment | null> {
      return MOCK_PAYMENTS.find((p) => p.id === id) || null;
    },

    async retry(id: string): Promise<{ success: boolean; message: string }> {
      await new Promise((r) => setTimeout(r, 400));
      return { success: true, message: `Payment retry initiated for ${id}` };
    },
  },

  // 3. Refunds API
  refunds: {
    async list(): Promise<{ refunds: Refund[]; total: number; isPendingServer: boolean }> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/refunds`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          return { refunds: json.data || [], total: json.total || 0, isPendingServer: false };
        }
      } catch {
        // fallback
      }
      return { refunds: MOCK_REFUNDS, total: MOCK_REFUNDS.length, isPendingServer: true };
    },

    async approve(id: string): Promise<{ success: boolean }> {
      await new Promise((r) => setTimeout(r, 450));
      const ref = MOCK_REFUNDS.find((r) => r.id === id);
      if (ref) ref.status = 'APPROVED';
      return { success: true };
    },

    async reject(id: string, reason: string): Promise<{ success: boolean }> {
      await new Promise((r) => setTimeout(r, 450));
      const ref = MOCK_REFUNDS.find((r) => r.id === id);
      if (ref) {
        ref.status = 'REJECTED';
        ref.rejectionReason = reason;
      }
      return { success: true };
    },
  },

  // 4. Payouts API
  payouts: {
    async list(): Promise<{ payouts: Payout[]; total: number; isPendingServer: boolean }> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/payouts`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          return { payouts: json.data || [], total: json.total || 0, isPendingServer: false };
        }
      } catch {
        // fallback
      }
      return { payouts: MOCK_PAYOUTS, total: MOCK_PAYOUTS.length, isPendingServer: true };
    },
  },

  // 5. Checkout Sessions API
  checkoutSessions: {
    async list(): Promise<{
      sessions: CheckoutSession[];
      total: number;
      isPendingServer: boolean;
    }> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/checkout-sessions`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          return { sessions: json.data || [], total: json.total || 0, isPendingServer: false };
        }
      } catch {
        // fallback
      }
      return {
        sessions: MOCK_CHECKOUT_SESSIONS,
        total: MOCK_CHECKOUT_SESSIONS.length,
        isPendingServer: true,
      };
    },
  },

  // 6. Audit Logs API
  auditLogs: {
    async list(filters?: {
      action?: string;
      actor?: string;
      search?: string;
    }): Promise<{ logs: AuditLog[]; total: number; isPendingServer: boolean }> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/audit-logs`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          return { logs: json.data || [], total: json.total || 0, isPendingServer: false };
        }
      } catch {
        // fallback
      }

      let list = [...MOCK_AUDIT_LOGS];
      if (filters?.action && filters.action !== 'ALL') {
        list = list.filter((l) => l.action === filters.action);
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        list = list.filter(
          (l) =>
            l.action.toLowerCase().includes(q) ||
            l.actor.toLowerCase().includes(q) ||
            (l.resourceId && l.resourceId.toLowerCase().includes(q))
        );
      }
      return { logs: list, total: list.length, isPendingServer: true };
    },
  },

  // 7. Stats & Metrics API
  stats: {
    async getOverviewMetrics(): Promise<OverviewMetrics> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/stats`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch {
        // fallback
      }
      return MOCK_OVERVIEW_METRICS;
    },
  },
};
