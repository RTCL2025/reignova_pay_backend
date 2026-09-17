import { z } from 'zod';
import { PaymentStatus } from '../models/payment.model.js';

export const createPaymentSchema = z.object({
  reference: z
    .string({ required_error: 'Payment reference is required' })
    .trim()
    .min(1, 'Reference cannot be empty')
    .max(100, 'Reference cannot exceed 100 characters'),
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be greater than zero')
    .max(100000000, 'Amount exceeds maximum allowable threshold')
    .refine((val) => Number(val.toFixed(2)) === val, {
      message: 'Amount cannot have more than 2 decimal places'
    }),
  currency: z
    .string({ required_error: 'Currency is required' })
    .trim()
    .toUpperCase()
    .length(3, 'Currency must be a 3-letter ISO code (e.g. TZS, ZMW, KES)'),
  phoneNumber: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(
      /^\+[1-9]\d{7,14}$/,
      'Phone number must be in E.164 international format starting with + (e.g. +255700000000)'
    ),
  country: z
    .string({ required_error: 'Country code is required' })
    .trim()
    .toUpperCase()
    .length(2, 'Country must be a 2-letter ISO 3166-1 alpha-2 code (e.g. TZ, ZM, KE)'),
  provider: z
    .string()
    .trim()
    .max(50, 'Provider name cannot exceed 50 characters')
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

export const paymentFilterSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  reference: z.string().trim().optional(),
  phoneNumber: z.string().trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;
