import { z } from 'zod';

export const paymentFormSchema = z.object({
  provider: z.string().min(1, 'Please select your mobile money provider'),
  customerPhone: z
    .string()
    .min(1, 'Mobile money phone number is required')
    .transform((val) => val.trim().replace(/\s+/g, ''))
    .refine((val) => {
      // Allow +255... or 0... or 255...
      const tanzaniaRegex = /^(?:\+?255|0)(?:6[125789]|7[14568])\d{7}$/;
      return tanzaniaRegex.test(val);
    }, 'Enter a valid Tanzania mobile money number (e.g. 0754 123 456 or +255754123456)'),
  customerName: z
    .string()
    .max(100, 'Name must be 100 characters or fewer')
    .optional()
    .or(z.literal('')),
  customerEmail: z
    .string()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),
});

export type PaymentFormData = z.infer<typeof paymentFormSchema>;
