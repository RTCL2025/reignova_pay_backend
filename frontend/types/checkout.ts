export type CheckoutStatus =
  | 'PENDING'
  | 'WAITING_PAYMENT'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface SupportedProvider {
  id: string;
  name: string;
  code?: string;
  iconUrl?: string | null;
}

export interface CheckoutMerchant {
  name: string;
  slug: string;
  logoUrl?: string | null;
  returnUrl?: string | null;
  cancelUrl?: string | null;
}

export interface CheckoutCustomer {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface CheckoutSession {
  publicToken: string;
  reference: string;
  amount: number;
  currency: string;
  country: string;
  status: CheckoutStatus;
  merchant: CheckoutMerchant;
  customer: CheckoutCustomer;
  expiresAt: string;
  supportedProviders: SupportedProvider[];
  createdAt: string;
  failureReason?: string | null;
  failureCode?: string | null;
}

export interface InitiatePaymentPayload {
  provider: string;
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
}

export interface InitiatePaymentResult {
  status: CheckoutStatus;
  message: string;
  depositId?: string;
}

export interface CheckoutStatusResult {
  status: CheckoutStatus;
  failureReason?: string | null;
  failureCode?: string | null;
}
