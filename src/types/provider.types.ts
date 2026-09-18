export interface ProviderDepositRequest {
  paymentId: string;
  reference: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  country: string;
  provider?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export type ProviderDepositStatus = 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED';

export interface ProviderDepositResponse {
  providerPaymentId: string;
  status: ProviderDepositStatus;
  providerTransactionId?: string;
  rawResponse?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface ProviderStatusResponse {
  providerPaymentId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';
  providerTransactionId?: string;
  failureReason?: string;
  rawResponse?: unknown;
}

export interface ProviderPayoutRequest {
  paymentId: string;
  reference: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  country: string;
  provider?: string;
  description?: string;
  customerMessage?: string;
  metadata?: Record<string, unknown>;
}

export type ProviderPayoutStatus = 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED';

export interface ProviderPayoutResponse {
  providerPaymentId: string;
  status: ProviderPayoutStatus;
  providerTransactionId?: string;
  rawResponse?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface ProviderRefundRequest {
  refundId: string;
  depositId: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export type ProviderRefundStatus = 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED';

export interface ProviderRefundResponse {
  refundId: string;
  status: ProviderRefundStatus;
  rawResponse?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface CheckoutAmountItem {
  country: string;
  currency: string;
  amount: number | string;
}

export interface ProviderCheckoutRequest {
  checkoutId: string;
  reference: string;
  returnUrl: string;
  returnMethod?: string;
  defaultLanguage?: string;
  countries?: string[];
  amounts?: CheckoutAmountItem[];
  payer?: {
    phoneNumber?: string;
    email?: string;
    name?: string;
    allowCustomerToOverride?: boolean;
    [key: string]: unknown;
  };
  reason?: Record<string, unknown>;
  expiresAfter?: number;
  metadata?: Record<string, unknown>;
}

export interface ProviderCheckoutResponse {
  checkoutId: string;
  status: 'WAITING_PAYMENT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  redirectUrl?: string;
  checkoutCode?: string;
  expiresAt?: string;
  rawResponse?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface ProviderCheckoutStatusResponse {
  checkoutId: string;
  status: 'WAITING_PAYMENT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  redirectUrl?: string;
  checkoutCode?: string;
  expiresAt?: string;
  depositId?: string;
  depositStatus?: string;
  depositsHistory?: unknown[];
  rawResponse?: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  initiateDeposit(request: ProviderDepositRequest): Promise<ProviderDepositResponse>;
  checkStatus(providerPaymentId: string): Promise<ProviderStatusResponse>;
  predictProvider?(phoneNumber: string): Promise<string | null>;

  // Payouts
  initiatePayout(request: ProviderPayoutRequest): Promise<ProviderPayoutResponse>;
  checkPayoutStatus(providerPaymentId: string): Promise<ProviderStatusResponse>;

  // Refunds
  initiateRefund(request: ProviderRefundRequest): Promise<ProviderRefundResponse>;
  checkRefundStatus(refundId: string): Promise<ProviderStatusResponse>;

  // Checkouts
  initiateCheckout(request: ProviderCheckoutRequest): Promise<ProviderCheckoutResponse>;
  checkCheckoutStatus(checkoutId: string): Promise<ProviderCheckoutStatusResponse>;
}
