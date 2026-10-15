import { z } from 'zod';

export const listMessagesSchema = z.object({
  params: z.object({ conversationId: z.string().min(1) }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    /** Message id to page "older than" (cursor-based, ordered newest-first). */
    cursor: z.string().min(1).optional(),
  }),
});

export const sendMessageSchema = z.object({
  params: z.object({ conversationId: z.string().min(1) }),
  body: z.object({
    content: z.string().trim().min(1).max(4000),
  }),
});

export const messageIdSchema = z.object({
  params: z.object({ messageId: z.string().min(1) }),
});

export const updateMessageSchema = z.object({
  params: z.object({ messageId: z.string().min(1) }),
  body: z.object({ content: z.string().trim().min(1).max(4000) }),
});
