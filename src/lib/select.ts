import type { Prisma } from '@prisma/client';

/**
 * Public fields safe to expose for ANY user (including other users' data:
 * search results, profiles, conversation members, message senders, friends).
 * Deliberately excludes `email` — it is private PII.
 */
export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  online: true,
  lastSeenAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** Like publicUserSelect, but for the authenticated user's OWN profile (includes email). */
export const selfUserSelect = {
  ...publicUserSelect,
  email: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
export type SelfUser = Prisma.UserGetPayload<{ select: typeof selfUserSelect }>;

/**
 * Strips sensitive fields from a full user row (e.g. after password checks).
 * This is the user's OWN account (login/refresh responses), so email is kept.
 */
export function pickSelfUser(
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    online: boolean;
    lastSeenAt: Date | null;
    createdAt: Date;
  },
): SelfUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    online: user.online,
    lastSeenAt: user.lastSeenAt,
    createdAt: user.createdAt,
  };
}
