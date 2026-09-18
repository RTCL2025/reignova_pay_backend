import { z } from 'zod';

export const pawapayCallbackSchema = z.object({
  depositId: z.string().uuid('depositId must be a valid UUID'),
  status: z.enum(['ACCEPTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'IN_RECONCILIATION', 'ENQUEUED']),
  amount: z.string().optional(),
  requestedAmount: z.string().optional(),
  currency: z.string().optional(),
  country: z.string().optional(),
  payer: z
    .object({
      type: z.string().optional(),
      accountDetails: z
        .object({
          phoneNumber: z.string().optional(),
          provider: z.string().optional()
        })
        .optional()
    })
    .optional(),
  providerTransactionId: z.string().optional(),
  failureReason: z
    .object({
      code: z.string().optional(),
      failureCode: z.string().optional(),
      message: z.string().optional(),
      failureMessage: z.string().optional()
    })
    .optional(),
  clientReferenceId: z.string().optional(),
  customerMessage: z.string().optional(),
  created: z.string().optional(),
  respondedByPayer: z.string().optional(),
  metadata: z.union([z.record(z.unknown()), z.array(z.record(z.unknown()))]).optional()
});

export type PawapayCallbackInput = z.infer<typeof pawapayCallbackSchema>;

export const pawapayPayoutCallbackSchema = z.object({
  payoutId: z.string().uuid('payoutId must be a valid UUID'),
  status: z.enum(['ACCEPTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'IN_RECONCILIATION', 'ENQUEUED']),
  amount: z.string().optional(),
  currency: z.string().optional(),
  recipient: z
    .object({
      type: z.string().optional(),
      accountDetails: z
        .object({
          phoneNumber: z.string().optional(),
          provider: z.string().optional()
        })
        .optional()
    })
    .optional(),
  providerTransactionId: z.string().optional(),
  failureReason: z
    .object({
      code: z.string().optional(),
      failureCode: z.string().optional(),
      message: z.string().optional(),
      failureMessage: z.string().optional()
    })
    .optional(),
  clientReferenceId: z.string().optional(),
  customerMessage: z.string().optional(),
  created: z.string().optional(),
  metadata: z.union([z.record(z.unknown()), z.array(z.record(z.unknown()))]).optional()
});

export type PawapayPayoutCallbackInput = z.infer<typeof pawapayPayoutCallbackSchema>;

export const pawapayRefundCallbackSchema = z.object({
  refundId: z.string().uuid('refundId must be a valid UUID'),
  depositId: z.string().uuid('depositId must be a valid UUID').optional(),
  status: z.enum(['ACCEPTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'IN_RECONCILIATION', 'ENQUEUED']),
  amount: z.string().optional(),
  currency: z.string().optional(),
  failureReason: z
    .object({
      code: z.string().optional(),
      failureCode: z.string().optional(),
      message: z.string().optional(),
      failureMessage: z.string().optional()
    })
    .optional(),
  created: z.string().optional(),
  metadata: z.union([z.record(z.unknown()), z.array(z.record(z.unknown()))]).optional()
});

export type PawapayRefundCallbackInput = z.infer<typeof pawapayRefundCallbackSchema>;

export const pawapayCheckoutCallbackSchema = z.object({
  checkoutId: z.string().uuid('checkoutId must be a valid UUID'),
  status: z.enum(['WAITING_PAYMENT', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED', 'ACCEPTED']),
  redirectUrl: z.string().optional(),
  checkoutCode: z.string().optional(),
  expiresAt: z.string().optional(),
  deposit: z
    .object({
      depositId: z.string().optional(),
      status: z.string().optional(),
      amount: z.string().optional(),
      currency: z.string().optional(),
      payer: z.unknown().optional()
    })
    .optional(),
  depositsHistory: z.array(z.record(z.unknown())).optional(),
  failureReason: z.union([
    z.string(),
    z.object({
      code: z.string().optional(),
      failureCode: z.string().optional(),
      message: z.string().optional(),
      failureMessage: z.string().optional()
    })
  ]).optional()
});

export type PawapayCheckoutCallbackInput = z.infer<typeof pawapayCheckoutCallbackSchema>;

