import { z } from 'zod';

export const createApplicationSchema = z.object({
  name: z
    .string({ required_error: 'Application name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  slug: z
    .string({ required_error: 'Slug is required' })
    .trim()
    .toLowerCase()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug cannot exceed 100 characters')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must consist of lowercase alphanumeric characters and hyphens'
    ),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional(),
  webhookUrl: z
    .string()
    .trim()
    .url('webhookUrl must be a valid URL')
    .max(500, 'webhookUrl cannot exceed 500 characters')
    .optional()
});

export const updateApplicationSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  webhookUrl: z.string().trim().url().max(500).optional()
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
