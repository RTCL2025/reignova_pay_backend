import { z } from 'zod';
import { PaymentStatus } from '../models/payment.model.js';

export const createPayoutSchema = z.object({
  reference: z
    .string({ required_error: 'Payout reference is required' })
    .trim()
    .min(1, 'Reference cannot be empty')
    .max(100, 'Reference cannot exceed 100 characters'),
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be greater than zero')
    .max(100000000, 'Amount exceeds maximum allowable threshold'),
  currency: z
    .string({ required_error: 'Currency is required' })
    .trim()
    .length(3, 'Currency must be a 3-letter ISO 4217 code')
    .toUpperCase(),
  phoneNumber: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(
      /^\+[1-9]\d{6,14}$/,
      'Phone number must be a valid mobile number in E.164 format (e.g. +255754123456)'
    ),
  country: z
    .string({ required_error: 'Country is required' })
    .trim()
    .min(2, 'Country code must be 2 or 3 letters')
    .max(3, 'Country code must be 2 or 3 letters')
    .toUpperCase(),
  provider: z.string().trim().optional(),
  customerMessage: z
    .string()
    .trim()
    .min(4, 'Customer message must be at least 4 characters')
    .max(22, 'Customer message cannot exceed 22 characters')
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

export const payoutFilterSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  reference: z.string().trim().optional(),
  phoneNumber: z.string().trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export type CreatePayoutInput = z.infer<typeof createPayoutSchema>;
export type PayoutFilterInput = z.infer<typeof payoutFilterSchema>;
