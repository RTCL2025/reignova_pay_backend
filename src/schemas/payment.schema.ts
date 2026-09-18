import { z } from 'zod';
import { PaymentStatus } from '../models/payment.model.js';

export const SUPPORTED_TZ_PROVIDERS = [
  'VODACOM_TZA',
  'AIRTEL_TZA',
  'TIGO_TZA',
  'YAS_TZA',
  'VODACOM',
  'AIRTEL',
  'TIGO',
  'YAS'
] as const;

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
    .refine((val) => Number.isInteger(val), {
      message: 'Amount in TZS must be a whole integer without decimal places'
    }),
  currency: z.literal('TZS', {
    errorMap: () => ({ message: 'Only TZS currency is supported for Tanzania payments' })
  }),
  phoneNumber: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(
      /^\+255\d{9}$/,
      'Phone number must be a valid Tanzanian mobile number in E.164 format starting with +255 followed by 9 digits (e.g. +255754123456)'
    ),
  country: z.literal('TZ', {
    errorMap: () => ({ message: 'Only Tanzania (country code "TZ") is supported' })
  }),
  provider: z
    .enum(SUPPORTED_TZ_PROVIDERS, {
      errorMap: () => ({
        message:
          'Provider must be one of: VODACOM_TZA, AIRTEL_TZA, YAS_TZA, TIGO_TZA (or VODACOM, AIRTEL, YAS)'
      })
    })
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
