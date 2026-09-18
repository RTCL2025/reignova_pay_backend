export type ApplicationStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface Application {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  apiKeyHash?: string;
  apiKeyPrefix: string;
  status: ApplicationStatus;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
  createdAt: string;
  updatedAt: string;
  totalVolume?: number;
  transactionCount?: number;
}

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PaymentType = 'DEPOSIT' | 'PAYOUT' | 'REFUND';

export interface Payment {
  id: string;
  applicationId: string;
  applicationName?: string;
  reference: string;
  type: PaymentType;
  amount: number;
  currency: string;
  phoneNumber: string;
  country: string;
  provider?: string | null;
  providerPaymentId?: string | null;
  status: PaymentStatus;
  failureReason?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  originalPaymentId?: string | null;
  customerMessage?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RefundStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED';

export interface Refund {
  id: string;
  paymentId: string;
  originalPaymentRef: string;
  applicationId: string;
  applicationName: string;
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  requestedBy: string;
  approvedBy?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PayoutStatus =
  | 'PENDING'
  | 'INITIATED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface Payout {
  id: string;
  applicationId: string;
  applicationName: string;
  recipientPhone: string;
  recipientName: string;
  amount: number;
  currency: string;
  provider: string;
  status: PayoutStatus;
  createdAt: string;
  updatedAt: string;
}

export type CheckoutSessionStatus =
  | 'CREATED'
  | 'OPEN'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface CheckoutSession {
  id: string;
  applicationId: string;
  applicationName: string;
  reference: string;
  publicToken: string;
  providerCheckoutId?: string | null;
  amount: number;
  currency: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  sessionStatus: CheckoutSessionStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  expiresAt: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  applicationId?: string | null;
  applicationName?: string | null;
  resourceType: string;
  resourceId: string;
  action: string;
  result: 'SUCCESS' | 'FAILURE';
  ipAddress?: string | null;
  correlationId?: string | null;
  userAgent?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export type AdminRole =
  | 'SUPER_ADMIN'
  | 'OPERATIONS_ADMIN'
  | 'FINANCE_ADMIN'
  | 'AUDITOR'
  | 'SUPPORT_AGENT';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  avatarUrl?: string;
  lastActive: string;
}

export interface OverviewMetrics {
  totalVolume: number;
  volumeTrend: number;
  successfulTx: number;
  successRate: number;
  pendingTx: number;
  failedTx: number;
  failureRate: number;
  activeMerchants: number;
  suspendedMerchants: number;
  totalRefundVolume: number;
}
