import { z } from 'zod';
import { PaymentStatus } from '../models/payment.model.js';

export const createRefundSchema = z.object({
  depositPaymentId: z
    .string({ required_error: 'depositPaymentId is required' })
    .uuid('depositPaymentId must be a valid UUID referencing the original deposit'),
  reference: z
    .string({ required_error: 'Refund reference is required' })
    .trim()
    .min(1, 'Reference cannot be empty')
    .max(100, 'Reference cannot exceed 100 characters'),
  amount: z
    .number()
    .positive('Refund amount must be greater than zero')
    .optional(),
  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter ISO 4217 code')
    .toUpperCase()
    .optional(),
  description: z
    .string()
    .trim()
    .max(255, 'Description cannot exceed 255 characters')
    .optional(),
  metadata: z
    .record(z.unknown())
    .refine((obj) => Object.keys(obj).length <= 25, {
      message: 'Metadata cannot exceed 25 key-value pairs'
    })
    .optional()
});

export const refundFilterSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  reference: z.string().trim().optional(),
  originalPaymentId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type RefundFilterInput = z.infer<typeof refundFilterSchema>;
