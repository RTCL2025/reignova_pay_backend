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

export interface PaymentProvider {
  readonly name: string;
  initiateDeposit(request: ProviderDepositRequest): Promise<ProviderDepositResponse>;
  checkStatus(providerPaymentId: string): Promise<ProviderStatusResponse>;
  predictProvider?(phoneNumber: string): Promise<string | null>;
}
