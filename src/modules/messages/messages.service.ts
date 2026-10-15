import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { badRequestError, forbiddenError, notFoundError } from '../../lib/ApiError.js';
import { publicUserSelect } from '../../lib/select.js';
import { EVENTS } from '../../socket/events.js';
import { hub } from '../../socket/hub.js';

const messageInclude = {
  sender: { select: publicUserSelect },
  readReceipts: true,
  attachments: true,
} satisfies Prisma.MessageInclude;

export type MessageWithRelations = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

async function requireMember(userId: string, conversationId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true, role: true },
  });
  if (!member) throw notFoundError('Conversation not found');
  return member;
}

export async function listMessages(
  userId: string,
  conversationId: string,
  input: { limit: number; cursor?: string },
) {
  await requireMember(userId, conversationId);

  const where: Prisma.MessageWhereInput = { conversationId, deletedAt: null };
  if (input.cursor) {
    const cursorMessage = await prisma.message.findUnique({
      where: { id: input.cursor },
      select: { createdAt: true },
    });
    if (cursorMessage) where.createdAt = { lt: cursorMessage.createdAt };
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: input.limit + 1,
    include: messageInclude,
  });

  const hasMore = messages.length > input.limit;
  const items = hasMore ? messages.slice(0, input.limit) : messages;

  return {
    // Oldest-first for the client, but fetched newest-first internally.
    items: items.reverse(),
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]!.id : null,
  };
}

export async function sendMessage(userId: string, conversationId: string, content: string) {
  await requireMember(userId, conversationId);

  const message = await prisma.message.create({
    data: { conversationId, senderId: userId, content, type: 'TEXT' },
    include: messageInclude,
  });

  // Touch the conversation so it bubbles to the top of listConversations.
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  hub.emitToConversation(conversationId, EVENTS.MESSAGE_NEW, { message });
  return message;
}

export async function updateMessage(userId: string, messageId: string, content: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt) throw notFoundError('Message not found');
  if (message.senderId !== userId) throw forbiddenError('Only the sender can edit a message');

  // The sender must still be a member (leaving/being removed revokes write access).
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: message.conversationId, userId } },
    select: { id: true },
  });
  if (!member) throw notFoundError('Conversation not found');

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content, edited: true },
    include: messageInclude,
  });
  hub.emitToConversation(message.conversationId, EVENTS.MESSAGE_UPDATED, { message: updated });
  return updated;
}

export async function deleteMessage(userId: string, messageId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt) throw notFoundError('Message not found');

  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: message.conversationId, userId } },
  });
  if (!member) throw notFoundError('Conversation not found');
  const canModerate = member.role === 'OWNER' || member.role === 'ADMIN';
  if (message.senderId !== userId && !canModerate) {
    throw forbiddenError('Only the sender or a group moderator can delete a message');
  }

  const deleted = await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), content: null },
  });
  hub.emitToConversation(message.conversationId, EVENTS.MESSAGE_DELETED, {
    conversationId: message.conversationId,
    messageId,
    deletedAt: deleted.deletedAt,
  });
  return { id: messageId, deletedAt: deleted.deletedAt };
}

export function assertContentNonEmpty(content: string): void {
  if (!content.trim()) throw badRequestError('Message content cannot be empty');
}
