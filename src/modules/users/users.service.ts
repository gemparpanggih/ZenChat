import { prisma } from '../../config/db.js';
import { notFoundError } from '../../lib/ApiError.js';
import { publicUserSelect } from '../../lib/select.js';

export async function searchUsers(q: string | undefined, currentUserId: string, limit: number) {
  if (!q) return [];
  return prisma.user.findMany({
    where: {
      id: { not: currentUserId },
      OR: [
        { username: { contains: q } },
        { displayName: { contains: q } },
        { email: { contains: q } },
      ],
    },
    select: publicUserSelect,
    take: limit,
    orderBy: { username: 'asc' },
  });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  if (!user) throw notFoundError('User not found');
  return user;
}

export async function updateMe(
  userId: string,
  data: { displayName?: string | null; bio?: string | null },
) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: publicUserSelect,
  });
}

export async function setAvatar(userId: string, avatarUrl: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
    select: publicUserSelect,
  });
}
