import { z } from 'zod';
import { CheckoutStatus } from '../models/checkout.model.js';

export const checkoutAmountItemSchema = z.object({
  country: z.string().trim().min(2).max(3).toUpperCase(),
  currency: z.string().trim().length(3).toUpperCase(),
  amount: z.union([z.number().positive(), z.string().trim().min(1)])
});

export const createCheckoutSchema = z.object({
  reference: z
    .string({ required_error: 'Checkout reference is required' })
    .trim()
    .min(1, 'Reference cannot be empty')
    .max(100, 'Reference cannot exceed 100 characters'),
  returnUrl: z
    .string({ required_error: 'returnUrl is required' })
    .url('returnUrl must be a valid URL'),
  returnMethod: z.enum(['GET', 'POST']).optional().default('GET'),
  defaultLanguage: z.string().trim().min(2).max(10).optional().default('en'),
  countries: z.array(z.string().trim().min(2).max(3).toUpperCase()).optional(),
  amounts: z.array(checkoutAmountItemSchema).optional(),
  payer: z
    .object({
      phoneNumber: z.string().optional(),
      email: z.string().email().optional(),
      name: z.string().optional(),
      allowCustomerToOverride: z.boolean().optional()
    })
    .passthrough()
    .optional(),
  reason: z.record(z.unknown()).optional(),
  expiresAfter: z
    .number()
    .int()
    .min(3, 'expiresAfter must be at least 3 minutes')
    .max(60, 'expiresAfter cannot exceed 60 minutes')
    .optional(),
  metadata: z
    .record(z.unknown())
    .refine((obj) => Object.keys(obj).length <= 25, {
      message: 'Metadata cannot exceed 25 key-value pairs'
    })
    .optional()
});

export const checkoutFilterSchema = z.object({
  status: z.nativeEnum(CheckoutStatus).optional(),
  reference: z.string().trim().optional(),
  checkoutCode: z.string().trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type CheckoutFilterInput = z.infer<typeof checkoutFilterSchema>;
