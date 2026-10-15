import { z } from 'zod';

export const sendRequestSchema = z.object({
  body: z.object({ userId: z.string().min(1) }),
});

export const respondSchema = z.object({
  params: z.object({ friendshipId: z.string().min(1) }),
  body: z.object({ status: z.enum(['ACCEPTED', 'DECLINED']) }),
});

export const listFriendsSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED']).optional(),
  }),
});

export const friendIdSchema = z.object({
  params: z.object({ friendId: z.string().min(1) }),
});
