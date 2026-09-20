import { apiClient } from './api-client';
import type {
  CheckoutSession,
  InitiatePaymentPayload,
  InitiatePaymentResult,
  CheckoutStatusResult,
} from '@/types/checkout';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export async function getCheckoutSession(publicToken: string): Promise<CheckoutSession> {
  const res = await apiClient<ApiResponse<CheckoutSession>>(
    `/checkouts/public/${encodeURIComponent(publicToken)}`
  );
  return res.data;
}

export async function initiatePayment(
  publicToken: string,
  payload: InitiatePaymentPayload
): Promise<InitiatePaymentResult> {
  const phone = payload.phoneNumber || payload.customerPhone || '';
  const body = {
    ...payload,
    phoneNumber: phone,
    customerPhone: phone,
  };

  const res = await apiClient<ApiResponse<InitiatePaymentResult>>(
    `/checkouts/public/${encodeURIComponent(publicToken)}/pay`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  return res.data;
}

export async function getCheckoutStatus(publicToken: string): Promise<CheckoutStatusResult> {
  const res = await apiClient<ApiResponse<CheckoutStatusResult>>(
    `/checkouts/public/${encodeURIComponent(publicToken)}/status`
  );
  return res.data;
}

export async function cancelCheckoutSession(publicToken: string): Promise<CheckoutStatusResult> {
  const res = await apiClient<ApiResponse<CheckoutStatusResult>>(
    `/checkouts/public/${encodeURIComponent(publicToken)}/cancel`,
    {
      method: 'POST',
    }
  );
  return res.data;
}

export async function simulateCheckoutApproval(publicToken: string): Promise<CheckoutStatusResult> {
  const res = await apiClient<ApiResponse<CheckoutStatusResult>>(
    `/checkouts/public/${encodeURIComponent(publicToken)}/simulate-approval`,
    {
      method: 'POST',
    }
  );
  return res.data;
}

export async function simulateCheckoutTimeout(publicToken: string): Promise<CheckoutStatusResult> {
  const res = await apiClient<ApiResponse<CheckoutStatusResult>>(
    `/checkouts/public/${encodeURIComponent(publicToken)}/simulate-timeout`,
    {
      method: 'POST',
    }
  );
  return res.data;
}
