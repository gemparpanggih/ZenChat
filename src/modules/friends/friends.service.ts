import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { badRequestError, conflictError, notFoundError } from '../../lib/ApiError.js';
import { publicUserSelect } from '../../lib/select.js';
import { EVENTS } from '../../socket/events.js';
import { hub } from '../../socket/hub.js';

const friendshipInclude = {
  sender: { select: publicUserSelect },
  receiver: { select: publicUserSelect },
} satisfies Prisma.FriendshipInclude;

export async function sendRequest(senderId: string, targetId: string) {
  if (senderId === targetId) throw badRequestError('You cannot add yourself');

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) throw notFoundError('User not found');

  const existing = await prisma.friendship.findFirst({
    where: { OR: [{ senderId, receiverId: targetId }, { senderId: targetId, receiverId: senderId }] },
  });
  if (existing) {
    if (existing.status === 'ACCEPTED') throw conflictError('Already friends');
    if (existing.status === 'PENDING') throw conflictError('A friend request is already pending');
    if (existing.status === 'BLOCKED') throw badRequestError('Cannot send a request to this user');
  }

  const friendship = await prisma.friendship.create({
    data: { senderId, receiverId: targetId, status: 'PENDING' },
    include: friendshipInclude,
  });
  hub.emitToUser(targetId, EVENTS.FRIEND_REQUEST, { friendship });
  return friendship;
}

export async function respond(userId: string, friendshipId: string, status: 'ACCEPTED' | 'DECLINED') {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    include: friendshipInclude,
  });
  if (!friendship) throw notFoundError('Friend request not found');
  if (friendship.receiverId !== userId) throw badRequestError('Only the recipient can respond');
  if (friendship.status !== 'PENDING') throw conflictError('This request has already been handled');

  const updated = await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status },
    include: friendshipInclude,
  });
  const otherId = friendship.senderId === userId ? friendship.receiverId : friendship.senderId;
  hub.emitToUser(otherId, EVENTS.FRIEND_RESPONSE, { friendship: updated });
  return updated;
}

export async function listFriends(userId: string, status?: string) {
  return prisma.friendship.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
      ...(status ? { status: status as Prisma.FriendshipWhereInput['status'] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: friendshipInclude,
  });
}

export async function removeFriend(userId: string, friendId: string) {
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { senderId: userId, receiverId: friendId },
        { senderId: friendId, receiverId: userId },
      ],
    },
  });
  if (!friendship) throw notFoundError('Friendship not found');
  await prisma.friendship.delete({ where: { id: friendship.id } });

  hub.emitToUser(friendId, EVENTS.FRIEND_REMOVED, { userId, friendId });
  return { id: friendship.id };
}
