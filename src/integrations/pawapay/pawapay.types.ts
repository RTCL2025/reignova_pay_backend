export interface PawapayPayerDetails {
  type: 'MMO';
  accountDetails: {
    phoneNumber: string; // MSISDN without +
    provider: string;    // e.g. MTN_MOMO_ZMB, VODACOM_MOMO_TZA
  };
}

export interface PawapayDepositRequest {
  depositId: string; // UUIDv4
  amount: string;    // String formatted number, e.g. "15.00" or "50000"
  currency: string;  // 3-letter ISO code
  country?: string;  // Omitted in Pawapay V2 /v2/deposits payload
  payer: PawapayPayerDetails;
  clientReferenceId?: string;
  customerMessage?: string;
  metadata?: Array<Record<string, string>>;
}

export interface PawapayDepositResponse {
  depositId: string;
  status: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED';
  rejectionReason?: {
    code: string;
    message: string;
  };
}

export type PawapayStatus =
  | 'ACCEPTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'IN_RECONCILIATION'
  | 'ENQUEUED';

export interface PawapayRecipientDetails {
  type: 'MMO';
  accountDetails: {
    phoneNumber: string; // MSISDN without +
    provider: string;    // e.g. MTN_MOMO_ZMB, VODACOM_MOMO_TZA
  };
}

export interface PawapayPayoutRequest {
  payoutId: string; // UUIDv4
  amount: string;
  currency: string;
  recipient: PawapayRecipientDetails;
  customerMessage: string;
  clientReferenceId?: string;
  metadata?: Array<Record<string, string>>;
}

export interface PawapayPayoutResponse {
  payoutId: string;
  status: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED';
  rejectionReason?: {
    code: string;
    message: string;
  };
}

export interface PawapayPayoutStatusData {
  payoutId: string;
  status: PawapayStatus;
  amount: string;
  currency: string;
  recipient: {
    type: string;
    accountDetails: {
      phoneNumber: string;
      provider: string;
    };
  };
  providerTransactionId?: string;
  failureReason?: {
    code?: string;
    failureCode?: string;
    message?: string;
    failureMessage?: string;
  };
  clientReferenceId?: string;
  customerMessage?: string;
  created?: string;
  metadata?: Array<Record<string, string>> | Record<string, unknown>;
}

export interface PawapayPayoutStatusResponse {
  status: 'FOUND' | 'NOT_FOUND';
  data?: PawapayPayoutStatusData;
}

export interface PawapayPayoutCallbackPayload {
  payoutId: string;
  status: PawapayStatus;
  amount?: string;
  currency?: string;
  recipient?: {
    type?: string;
    accountDetails?: {
      phoneNumber?: string;
      provider?: string;
    };
  };
  providerTransactionId?: string;
  failureReason?: {
    code?: string;
    failureCode?: string;
    message?: string;
    failureMessage?: string;
  };
  clientReferenceId?: string;
  customerMessage?: string;
  created?: string;
  metadata?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export interface PawapayRefundRequest {
  refundId: string; // UUIDv4
  depositId: string; // UUIDv4
  amount?: string;
  currency?: string;
  metadata?: Array<Record<string, string>>;
}

export interface PawapayRefundResponse {
  refundId: string;
  status: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED';
  rejectionReason?: {
    code: string;
    message: string;
  };
}

export interface PawapayRefundStatusData {
  refundId: string;
  depositId: string;
  status: PawapayStatus;
  amount?: string;
  currency?: string;
  failureReason?: {
    code?: string;
    failureCode?: string;
    message?: string;
    failureMessage?: string;
  };
  created?: string;
  metadata?: Array<Record<string, string>> | Record<string, unknown>;
}

export interface PawapayRefundStatusResponse {
  status: 'FOUND' | 'NOT_FOUND';
  data?: PawapayRefundStatusData;
}

export interface PawapayRefundCallbackPayload {
  refundId: string;
  depositId: string;
  status: PawapayStatus;
  amount?: string;
  currency?: string;
  failureReason?: {
    code?: string;
    failureCode?: string;
    message?: string;
    failureMessage?: string;
  };
  created?: string;
  metadata?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export interface PawapayCheckoutRequest {
  checkoutId: string; // UUIDv4
  returnUrl: string;
  returnMethod?: 'INSTANT' | 'COUNTDOWN' | 'CUSTOMER_ACTION';
  defaultLanguage?: string;
  countries?: string[];
  amounts?: Array<{ country: string; currency: string; amount: string }>;
  payer?: {
    type: 'MMO';
    accountDetails: {
      phoneNumber?: string;
      provider?: string;
      allowCustomerToOverride: boolean;
    };
  };
  reason?: Record<string, string>;
  expiresAfter?: number;
  clientReferenceId?: string;
  metadata?: Array<Record<string, string>>;
}

export interface PawapayCheckoutResponse {
  checkoutId: string;
  status: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED' | 'WAITING_PAYMENT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  redirectUrl?: string;
  checkoutCode?: string;
  expiresAt?: string;
  created?: string;
  rejectionReason?: {
    code: string;
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface PawapayCheckoutStatusData {
  checkoutId: string;
  status: 'WAITING_PAYMENT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  redirectUrl?: string;
  checkoutCode?: string;
  expiresAt?: string;
  deposit?: {
    depositId: string;
    status: string;
    amount?: string;
    currency?: string;
    payer?: unknown;
  };
  depositsHistory?: Array<Record<string, unknown>>;
  failureReason?: string | {
    code?: string;
    failureCode?: string;
    message?: string;
    failureMessage?: string;
  };
}

export interface PawapayCheckoutStatusResponse {
  status: 'FOUND' | 'NOT_FOUND';
  data?: PawapayCheckoutStatusData;
}

export interface PawapayCheckoutCallbackPayload {
  checkoutId: string;
  status: 'WAITING_PAYMENT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  redirectUrl?: string;
  checkoutCode?: string;
  expiresAt?: string;
  deposit?: {
    depositId?: string;
    status?: string;
    amount?: string;
    currency?: string;
    payer?: unknown;
  };
  depositsHistory?: Array<Record<string, unknown>>;
  failureReason?: string | {
    code?: string;
    failureCode?: string;
    message?: string;
    failureMessage?: string;
  };
}

export interface PawapayDepositStatusData {
  depositId: string;
  status: PawapayStatus;
  amount: string;
  currency: string;
  country: string;
  payer: {
    type: string;
    accountDetails: {
      phoneNumber: string;
      provider: string;
    };
  };
  providerTransactionId?: string;
  failureReason?: {
    code: string;
    failureMessage: string;
  };
  clientReferenceId?: string;
  created?: string;
  respondedByPayer?: string;
}

export interface PawapayDepositStatusResponse {
  status: 'FOUND' | 'NOT_FOUND';
  data?: PawapayDepositStatusData;
}

export interface PawapayPredictProviderResponse {
  provider: string;
  country: string;
}

export interface PawapayCallbackPayload {
  depositId: string;
  status: PawapayStatus;
  amount?: string;
  requestedAmount?: string;
  currency?: string;
  country?: string;
  payer?: {
    type?: string;
    accountDetails?: {
      phoneNumber?: string;
      provider?: string;
    };
  };
  providerTransactionId?: string;
  failureReason?: {
    code?: string;
    failureCode?: string;
    message?: string;
    failureMessage?: string;
  };
  clientReferenceId?: string;
  customerMessage?: string;
  created?: string;
  respondedByPayer?: string;
  metadata?: Record<string, unknown> | Array<Record<string, unknown>>;
}

