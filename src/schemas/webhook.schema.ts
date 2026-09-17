import { z } from 'zod';

export const pawapayCallbackSchema = z.object({
  depositId: z.string().uuid('depositId must be a valid UUID'),
  status: z.enum(['ACCEPTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'IN_RECONCILIATION']),
  requestedAmount: z.string(),
  amount: z.string().optional(),
  currency: z.string(),
  country: z.string(),
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
      failureMessage: z.string().optional()
    })
    .optional(),
  clientReferenceId: z.string().optional(),
  created: z.string().optional(),
  respondedByPayer: z.string().optional(),
  metadata: z.array(z.record(z.string())).optional()
});

export type PawapayCallbackInput = z.infer<typeof pawapayCallbackSchema>;
