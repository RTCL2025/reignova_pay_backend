import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ProviderError } from '../../utils/errors.js';
import {
  PawapayDepositRequest,
  PawapayDepositResponse,
  PawapayDepositStatusResponse,
  PawapayPredictProviderResponse
} from './pawapay.types.js';

export class PawapayClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(
    baseUrl = env.PAWAPAY_BASE_URL,
    token = env.PAWAPAY_API_TOKEN,
    timeoutMs = env.PAWAPAY_REQUEST_TIMEOUT_MS
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
    this.timeoutMs = timeoutMs;
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST';
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<{ status: number; data: T }> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.token}`,
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeout);

      const responseText = await response.text();
      let data: T;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = responseText as unknown as T;
      }

      return { status: response.status, data };
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        logger.error({ url, timeoutMs: this.timeoutMs }, 'Pawapay API request timed out');
        throw new ProviderError(
          `Pawapay request timed out after ${this.timeoutMs}ms`,
          'pawapay',
          504
        );
      }
      logger.error({ err, url }, 'Pawapay API network connection error');
      throw new ProviderError(
        `Failed to communicate with Pawapay: ${err instanceof Error ? err.message : String(err)}`,
        'pawapay',
        502
      );
    }
  }

  /**
   * Initiates a mobile-money deposit (POST /v2/deposits)
   */
  async createDeposit(depositRequest: PawapayDepositRequest): Promise<PawapayDepositResponse> {
    const res = await this.request<PawapayDepositResponse>('/v2/deposits', {
      method: 'POST',
      body: depositRequest
    });

    if (res.status === 200 || res.status === 201 || res.status === 202) {
      return res.data;
    }

    if (res.status === 400 || res.status === 422) {
      // Rejection or invalid input from Pawapay
      return {
        depositId: depositRequest.depositId,
        status: 'REJECTED',
        rejectionReason: {
          code: ((res.data as unknown as Record<string, unknown>)?.errorCode as string) || 'REJECTED',
          message:
            ((res.data as unknown as Record<string, unknown>)?.errorMessage as string) ||
            ((res.data as unknown as Record<string, unknown>)?.message as string) ||
            'Deposit request was rejected by Pawapay'
        }
      };
    }

    throw new ProviderError(
      `Pawapay deposit creation failed with HTTP ${res.status}`,
      'pawapay',
      res.status,
      res.data
    );
  }

  /**
   * Retrieves status of a deposit by depositId (GET /v2/deposits/:depositId)
   */
  async getDepositStatus(depositId: string): Promise<PawapayDepositStatusResponse> {
    const res = await this.request<PawapayDepositStatusResponse>(`/v2/deposits/${depositId}`, {
      method: 'GET'
    });

    if (res.status === 200) {
      return res.data;
    }

    if (res.status === 404) {
      return { status: 'NOT_FOUND' };
    }

    throw new ProviderError(
      `Pawapay status check failed with HTTP ${res.status}`,
      'pawapay',
      res.status,
      res.data
    );
  }

  /**
   * Predicts mobile money provider based on phone number (POST /v2/predict-provider)
   */
  async predictProvider(phoneNumber: string): Promise<PawapayPredictProviderResponse | null> {
    try {
      const res = await this.request<PawapayPredictProviderResponse>('/v2/predict-provider', {
        method: 'POST',
        body: { phoneNumber }
      });

      if (res.status === 200 && res.data?.provider) {
        return res.data;
      }
      return null;
    } catch (err) {
      logger.warn({ err, phoneNumber }, 'Unable to auto-predict provider from Pawapay');
      return null;
    }
  }

  /**
   * Fetches Pawapay public key for RFC-9421 signature verification (GET /public-key/http)
   */
  async getPublicKey(): Promise<string> {
    const res = await this.request<string | { key: string }>('/public-key/http', {
      method: 'GET'
    });

    if (typeof res.data === 'string') {
      return res.data;
    }
    if (typeof res.data === 'object' && res.data && 'key' in res.data) {
      return res.data.key;
    }
    return String(res.data);
  }
}

export const pawapayClient = new PawapayClient();
export default pawapayClient;
