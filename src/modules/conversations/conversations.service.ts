import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import {
  badRequestError,
  conflictError,
  forbiddenError,
  notFoundError,
} from '../../lib/ApiError.js';
import { publicUserSelect } from '../../lib/select.js';
import { EVENTS } from '../../socket/events.js';
import { hub } from '../../socket/hub.js';

const conversationInclude = {
  members: { include: { user: { select: publicUserSelect } } },
} satisfies Prisma.ConversationInclude;

export type ConversationWithMembers = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;

export interface ConversationListItem {
  conversation: ConversationWithMembers;
  lastMessage: Prisma.MessageGetPayload<{
    include: { sender: { select: typeof publicUserSelect }; readReceipts: true; attachments: true };
  }> | null;
  unreadCount: number;
}

async function requireMember(userId: string, conversationId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true, role: true },
  });
  if (!member) throw notFoundError('Conversation not found');
  return member;
}

function requireRole(member: { role: string }, roles: string[]) {
  if (!roles.includes(member.role)) throw forbiddenError('Insufficient permissions');
}

export async function createConversation(userId: string, payload: {
  type: 'DIRECT' | 'GROUP';
  participantIds: string[];
  name?: string;
}) {
  const memberIds = [...new Set([userId, ...payload.participantIds])];

  if (payload.type === 'DIRECT') {
    const otherId = memberIds.find((id) => id !== userId);
    if (!otherId) throw badRequestError('Direct conversations need exactly one other participant');

    // Reuse an existing DM between these two users.
    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        members: { some: { userId: otherId } },
      },
      include: { members: true },
    });
    if (existing) {
      const ids = existing.members.map((m) => m.userId).sort();
      if (ids.length === 2 && ids.includes(userId)) {
        return { conversation: existing, created: false };
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        createdById: userId,
        members: { create: memberIds.map((id) => ({ userId: id, role: id === userId ? 'OWNER' : 'MEMBER' })) },
      },
      include: conversationInclude,
    });
    memberIds.forEach((id) => hub.addUserToConversation(id, conversation.id));
    conversation.members.forEach((m) => {
      hub.emitToUser(m.userId, EVENTS.CONVERSATION_NEW, { conversation });
    });
    return { conversation, created: true };
  }

  // GROUP
  if (memberIds.length < 2) throw badRequestError('Group conversations need at least two members');
  if (!payload.name) throw badRequestError('Group conversations require a name');

  await ensureUsersExist(memberIds);
  const conversation = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      name: payload.name,
      createdById: userId,
      members: { create: memberIds.map((id) => ({ userId: id, role: id === userId ? 'OWNER' : 'MEMBER' })) },
    },
    include: conversationInclude,
  });
  memberIds.forEach((id) => hub.addUserToConversation(id, conversation.id));
  conversation.members.forEach((m) => {
    hub.emitToUser(m.userId, EVENTS.CONVERSATION_NEW, { conversation });
  });
  return { conversation, created: true };
}

async function ensureUsersExist(userIds: string[]): Promise<void> {
  const count = await prisma.user.count({ where: { id: { in: userIds } } });
  if (count !== userIds.length) throw badRequestError('One or more participants do not exist');
}

export async function listConversations(userId: string, input: { limit: number; cursor?: string }) {
  const where: Prisma.ConversationMemberWhereInput = { userId };
  if (input.cursor) {
    const cursorConv = await prisma.conversation.findUnique({
      where: { id: input.cursor },
      select: { updatedAt: true },
    });
    if (cursorConv) where.conversation = { updatedAt: { lt: cursorConv.updatedAt } };
  }

  const memberships = await prisma.conversationMember.findMany({
    where,
    orderBy: { conversation: { updatedAt: 'desc' } },
    take: input.limit + 1,
    include: { conversation: { include: conversationInclude } },
  });

  const hasMore = memberships.length > input.limit;
  const page = hasMore ? memberships.slice(0, input.limit) : memberships;

  const items: ConversationListItem[] = [];
  for (const m of page) {
    const conversation = m.conversation;
    const [lastMessage, unreadCount] = await Promise.all([
      prisma.message.findFirst({
        where: { conversationId: conversation.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: publicUserSelect },
          readReceipts: true,
          attachments: true,
        },
      }),
      prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: userId },
          deletedAt: null,
          readReceipts: { none: { userId } },
        },
      }),
    ]);
    items.push({ conversation, lastMessage, unreadCount });
  }

  return {
    items,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]?.conversation.id : null,
  };
}

export async function getConversationById(userId: string, conversationId: string) {
  await requireMember(userId, conversationId);
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });
  if (!conversation) throw notFoundError('Conversation not found');
  return conversation;
}

export async function renameGroup(userId: string, conversationId: string, name: string) {
  const member = await requireMember(userId, conversationId);
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (conversation?.type !== 'GROUP') throw badRequestError('Only group conversations can be renamed');
  requireRole(member, ['OWNER', 'ADMIN']);

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { name },
    include: conversationInclude,
  });
  hub.emitToConversation(conversationId, EVENTS.CONVERSATION_UPDATED, { conversation: updated });
  return updated;
}

export async function addMembers(userId: string, conversationId: string, userIds: string[]) {
  const member = await requireMember(userId, conversationId);
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (conversation?.type !== 'GROUP') throw badRequestError('Only group conversations have members');
  requireRole(member, ['OWNER', 'ADMIN']);

  await ensureUsersExist(userIds);
  const existing = await prisma.conversationMember.findMany({
    where: { conversationId, userId: { in: userIds } },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((e) => e.userId));
  const fresh = userIds.filter((id) => !existingIds.has(id));
  if (fresh.length === 0) throw conflictError('All users are already members');

  await prisma.conversationMember.createMany({
    data: fresh.map((id) => ({ conversationId, userId: id, role: 'MEMBER' })),
  });

  const updated = (await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  }))!;

  fresh.forEach((id) => {
    hub.addUserToConversation(id, conversationId);
    const memberInfo = updated.members.find((m) => m.userId === id);
    if (memberInfo) {
      hub.emitToUser(id, EVENTS.CONVERSATION_NEW, { conversation: updated });
    }
  });
  hub.emitToConversation(conversationId, EVENTS.CONVERSATION_UPDATED, { conversation: updated });
  return updated;
}

export async function removeMember(userId: string, conversationId: string, targetUserId: string) {
  if (targetUserId === userId) throw badRequestError('Use leave instead of removing yourself');
  const member = await requireMember(userId, conversationId);
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (conversation?.type !== 'GROUP') throw badRequestError('Only group conversations have members');
  requireRole(member, ['OWNER', 'ADMIN']);

  const target = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });
  if (!target) throw notFoundError('Member not found');
  if (target.role === 'OWNER') throw forbiddenError('Cannot remove the owner');

  await prisma.conversationMember.delete({ where: { id: target.id } });
  hub.removeUserFromConversation(targetUserId, conversationId);
  hub.emitToConversation(conversationId, EVENTS.CONVERSATION_MEMBER_LEFT, {
    conversationId,
    userId: targetUserId,
  });

  return prisma.conversation.findUnique({ where: { id: conversationId }, include: conversationInclude });
}

export async function leaveConversation(userId: string, conversationId: string) {
  const member = await requireMember(userId, conversationId);
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: true },
  });
  if (!conversation) throw notFoundError('Conversation not found');

  if (conversation.type === 'DIRECT') {
    // Leaving a DM deletes it for everyone.
    await prisma.conversation.delete({ where: { id: conversationId } });
    hub.emitToConversation(conversationId, EVENTS.CONVERSATION_DELETED, { conversationId });
    return;
  }

  const remaining = conversation.members.filter((m) => m.userId !== userId);
  if (remaining.length === 0) {
    await prisma.conversation.delete({ where: { id: conversationId } });
    hub.emitToConversation(conversationId, EVENTS.CONVERSATION_DELETED, { conversationId });
    return;
  }

  await prisma.conversationMember.delete({ where: { id: member.id } });
  hub.removeUserFromConversation(userId, conversationId);
  hub.emitToConversation(conversationId, EVENTS.CONVERSATION_MEMBER_LEFT, { conversationId, userId });

  // If the owner left, hand ownership to the next member.
  if (conversation.members.every((m) => m.role !== 'OWNER') || member.role === 'OWNER') {
    await prisma.conversationMember.update({
      where: { id: remaining[0]!.id },
      data: { role: 'OWNER' },
    });
  }
}

export async function markConversationRead(userId: string, conversationId: string) {
  await requireMember(userId, conversationId);

  const unread = await prisma.message.findMany({
    where: {
      conversationId,
      senderId: { not: userId },
      deletedAt: null,
      readReceipts: { none: { userId } },
    },
    select: { id: true },
  });

  if (unread.length > 0) {
    await prisma.readReceipt.createMany({
      data: unread.map((m) => ({ messageId: m.id, userId })),
    });
  }

  const payload = {
    conversationId,
    userId,
    messageIds: unread.map((m) => m.id),
    readAt: new Date().toISOString(),
  };
  hub.emitToConversation(conversationId, EVENTS.MESSAGES_READ, payload);
  return payload;
}
