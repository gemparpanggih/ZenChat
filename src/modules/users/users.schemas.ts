import { z } from 'zod';

export const updateMeSchema = z.object({
  body: z.object({
    displayName: z.string().trim().min(1).max(50).nullable().optional(),
    bio: z.string().trim().max(500).nullable().optional(),
  }),
});

export const searchSchema = z.object({
  query: z.object({
    q: z.string().trim().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const getByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
