import type { Prisma } from '@prisma/client';

/** Public fields safe to expose for any user. Never include passwordHash. */
export const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  online: true,
  lastSeenAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/** Strips sensitive fields from a full user row (e.g. after password checks). */
export function pickPublicUser(
  user: { id: string; email: string; username: string; displayName: string | null; avatarUrl: string | null; bio: string | null; online: boolean; lastSeenAt: Date | null; createdAt: Date },
): PublicUser {
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
