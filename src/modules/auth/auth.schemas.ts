import { z } from 'zod';

const email = z.string().email().max(254);
const password = z.string().min(8).max(72);
const username = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores');

export const registerSchema = z.object({
  body: z.object({
    email,
    username,
    password,
    displayName: z.string().trim().min(1).max(50).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    /** Email OR username. */
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
});
