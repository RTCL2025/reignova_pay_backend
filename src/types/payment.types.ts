import { PaymentStatus } from '../models/payment.model.js';

export { PaymentStatus };

export enum PaymentType {
  DEPOSIT = 'DEPOSIT'
}

/**
 * Valid state transitions mapping: fromStatus -> Set of allowed toStatuses
 */
export const ALLOWED_STATE_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.PROCESSING,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED
  ],
  [PaymentStatus.PROCESSING]: [
    PaymentStatus.COMPLETED,
    PaymentStatus.FAILED,
    PaymentStatus.EXPIRED
  ],
  [PaymentStatus.COMPLETED]: [], // Terminal state
  [PaymentStatus.FAILED]: [],    // Terminal state
  [PaymentStatus.CANCELLED]: [], // Terminal state
  [PaymentStatus.EXPIRED]: []    // Terminal state
};

export function isValidTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true; // Idempotent no-op
  const allowed = ALLOWED_STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export interface CreatePaymentDto {
  reference: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  country: string;
  provider?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentFilters {
  status?: PaymentStatus;
  reference?: string;
  phoneNumber?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaymentResponse {
  id: string;
  applicationId: string;
  reference: string;
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
  completedAt?: Date | null;
  failedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
