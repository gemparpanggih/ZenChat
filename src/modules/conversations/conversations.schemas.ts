import { z } from 'zod';

export const createConversationSchema = z.object({
  body: z.object({
    type: z.enum(['DIRECT', 'GROUP']),
    /** User IDs besides the caller who should be members. */
    participantIds: z.array(z.string().min(1)).max(99).default([]),
    /** Required when type === GROUP. */
    name: z.string().trim().min(1).max(50).optional(),
  }),
});

export const listConversationsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(1).optional(),
  }),
});

export const getConversationSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const renameConversationSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ name: z.string().trim().min(1).max(50) }),
});

export const addMembersSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ userIds: z.array(z.string().min(1)).min(1).max(99) }),
});

export const removeMemberSchema = z.object({
  params: z.object({ id: z.string().min(1), userId: z.string().min(1) }),
});
