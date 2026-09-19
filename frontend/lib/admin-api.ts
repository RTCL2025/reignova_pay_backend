import {
  Application,
  Payment,
  Refund,
  Payout,
  CheckoutSession,
  AuditLog,
  OverviewMetrics,
} from '@/types/admin';

export interface AdminSearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Merchants' | 'Payments' | 'Refunds' | 'Payouts' | 'Checkout Sessions' | 'Audit Logs';
  href: string;
  badge?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

function getHeaders(customApiKey?: string): HeadersInit {
  let effectiveKey = customApiKey;
  if (!effectiveKey && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('reignova_admin_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        effectiveKey = parsed.token || parsed.apiKey;
      }
    } catch {
      // ignore
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (effectiveKey) {
    headers['Admin-Api-Key'] = effectiveKey;
    headers['Authorization'] = `Bearer ${effectiveKey}`;
  }

  return headers;
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
          const items: Application[] = (json.data || json.applications || []).map((app: any) => ({
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
            totalVolume: app.totalVolume || 0,
            transactionCount: app.transactionCount || 0,
          }));
          return {
            applications: items,
            total: json.meta?.total ?? items.length,
            isLive: true,
          };
        }
      } catch (err) {
        console.error('Failed to fetch merchants from live API:', err);
      }
      return { applications: [], total: 0, isLive: false };
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
      } catch (err) {
        console.error(`Failed to fetch merchant ${id}:`, err);
      }
      return null;
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
      page?: number;
      limit?: number;
    }): Promise<{ payments: Payment[]; total: number; isPendingServer: boolean }> {
      try {
        const params = new URLSearchParams();
        if (filters?.page) params.set('page', String(filters.page));
        if (filters?.limit) params.set('limit', String(filters.limit));
        if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
        if (filters?.merchantId && filters.merchantId !== 'ALL') params.set('applicationId', filters.merchantId);
        if (filters?.search) params.set('search', filters.search);

        const url = `${API_BASE_URL}/admin/payments${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, {
          headers: getHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          return {
            payments: json.data || [],
            total: json.meta?.total ?? (json.data ? json.data.length : 0),
            isPendingServer: false,
          };
        }
      } catch (err) {
        console.error('Failed to fetch payments from live API:', err);
      }

      return { payments: [], total: 0, isPendingServer: true };
    },

    async get(id: string): Promise<Payment | null> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/payments/${id}`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          return json.data || null;
        }
      } catch (err) {
        console.error(`Failed to fetch payment ${id}:`, err);
      }
      return null;
    },

    async retry(id: string): Promise<{ success: boolean; message: string }> {
      const res = await fetch(`${API_BASE_URL}/admin/payments/${id}/retry`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.message || `Payment retry failed for ${id}`);
      }
      const json = await res.json();
      return { success: true, message: json.data?.message || `Payment retry initiated for ${id}` };
    },
  },

  // 3. Refunds API
  refunds: {
    async list(
      page = 1,
      limit = 20
    ): Promise<{ refunds: Refund[]; total: number; isPendingServer: boolean }> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/refunds?page=${page}&limit=${limit}`, {
          headers: getHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          return {
            refunds: json.data || [],
            total: json.meta?.total ?? (json.data ? json.data.length : 0),
            isPendingServer: false,
          };
        }
      } catch (err) {
        console.error('Failed to fetch refunds from live API:', err);
      }
      return { refunds: [], total: 0, isPendingServer: true };
    },

    async approve(id: string): Promise<{ success: boolean }> {
      const res = await fetch(`${API_BASE_URL}/admin/refunds/${id}/approve`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.message || `Refund approval failed for ${id}`);
      }
      return { success: true };
    },

    async reject(id: string, reason: string): Promise<{ success: boolean }> {
      const res = await fetch(`${API_BASE_URL}/admin/refunds/${id}/reject`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.message || `Refund rejection failed for ${id}`);
      }
      return { success: true };
    },
  },

  // 4. Payouts API
  payouts: {
    async list(
      page = 1,
      limit = 20
    ): Promise<{ payouts: Payout[]; total: number; isPendingServer: boolean }> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/payouts?page=${page}&limit=${limit}`, {
          headers: getHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          return {
            payouts: json.data || [],
            total: json.meta?.total ?? (json.data ? json.data.length : 0),
            isPendingServer: false,
          };
        }
      } catch (err) {
        console.error('Failed to fetch payouts from live API:', err);
      }
      return { payouts: [], total: 0, isPendingServer: true };
    },

    async get(id: string): Promise<Payout | null> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/payouts/${id}`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          return json.data || null;
        }
      } catch (err) {
        console.error(`Failed to fetch payout ${id}:`, err);
      }
      return null;
    },
  },

  // 5. Checkout Sessions API
  checkoutSessions: {
    async list(
      page = 1,
      limit = 20
    ): Promise<{
      sessions: CheckoutSession[];
      total: number;
      isPendingServer: boolean;
    }> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/checkout-sessions?page=${page}&limit=${limit}`, {
          headers: getHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          return {
            sessions: json.data || [],
            total: json.meta?.total ?? (json.data ? json.data.length : 0),
            isPendingServer: false,
          };
        }
      } catch (err) {
        console.error('Failed to fetch checkout sessions from live API:', err);
      }
      return {
        sessions: [],
        total: 0,
        isPendingServer: true,
      };
    },

    async get(id: string): Promise<CheckoutSession | null> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/checkout-sessions/${id}`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          return json.data || null;
        }
      } catch (err) {
        console.error(`Failed to fetch checkout session ${id}:`, err);
      }
      return null;
    },
  },

  // 6. Audit Logs API
  auditLogs: {
    async list(filters?: {
      action?: string;
      actor?: string;
      search?: string;
      page?: number;
      limit?: number;
    }): Promise<{ logs: AuditLog[]; total: number; isPendingServer: boolean }> {
      try {
        const params = new URLSearchParams();
        if (filters?.page) params.set('page', String(filters.page));
        if (filters?.limit) params.set('limit', String(filters.limit));
        if (filters?.action && filters.action !== 'ALL') params.set('action', filters.action);
        if (filters?.actor) params.set('actor', filters.actor);
        if (filters?.search) params.set('search', filters.search);

        const url = `${API_BASE_URL}/admin/audit-logs${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, {
          headers: getHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          return {
            logs: json.data || [],
            total: json.meta?.total ?? (json.data ? json.data.length : 0),
            isPendingServer: false,
          };
        }
      } catch (err) {
        console.error('Failed to fetch audit logs from live API:', err);
      }

      return { logs: [], total: 0, isPendingServer: true };
    },

    async get(id: string): Promise<AuditLog | null> {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/audit-logs/${id}`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          return json.data || null;
        }
      } catch (err) {
        console.error(`Failed to fetch audit log ${id}:`, err);
      }
      return null;
    },
  },

  // 7. Stats & Metrics API
  stats: {
    async getOverviewMetrics(): Promise<OverviewMetrics> {
      const emptyMetrics: OverviewMetrics = {
        totalVolume: 0,
        volumeTrend: 0,
        successfulTx: 0,
        successRate: 100,
        pendingTx: 0,
        failedTx: 0,
        failureRate: 0,
        activeMerchants: 0,
        suspendedMerchants: 0,
        totalRefundVolume: 0,
        pendingRefundsCount: 0,
        providers: [],
        trend: [],
      };

      try {
        const res = await fetch(`${API_BASE_URL}/admin/stats`, {
          headers: getHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          return json.data || emptyMetrics;
        }
      } catch (err) {
        console.error('Failed to fetch overview metrics from live API:', err);
      }
      return emptyMetrics;
    },
  },

  // 8. Global Live Search API
  search: {
    async query(q: string): Promise<AdminSearchResultItem[]> {
      if (!q || !q.trim()) return [];
      try {
        const res = await fetch(`${API_BASE_URL}/admin/search?q=${encodeURIComponent(q.trim())}`, {
          headers: getHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          return json.data || [];
        }
      } catch (err) {
        console.error('Failed to execute admin search from live API:', err);
      }
      return [];
    },
  },
};
