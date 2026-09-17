export interface PawapayPayerDetails {
  type: 'MMO';
  accountDetails: {
    phoneNumber: string; // MSISDN without +
    provider: string;    // e.g. MTN_MOMO_ZMB, VODACOM_MOMO_TZA
  };
}

export interface PawapayDepositRequest {
  depositId: string; // UUIDv4
  amount: string;    // String formatted number, e.g. "15.00"
  currency: string;  // 3-letter ISO code
  country: string;   // 3-letter ISO code (TZA, ZMB, etc.)
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
  | 'IN_RECONCILIATION';

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
  requestedAmount: string;
  amount?: string;
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
  metadata?: Array<Record<string, string>>;
}
