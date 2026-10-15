import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../lib/token.js';
import { EVENTS } from './events.js';
import { hub } from './hub.js';

interface TypingPayload {
  conversationId: string;
  typing: boolean;
}

export function attachSocket(server: HttpServer): Server {
  const io = new Server(server, {
    cors: { origin: env.CLIENT_ORIGIN === '*' ? true : env.CLIENT_ORIGIN.split(',') },
  });
  hub.init(io);

  // Auth: clients must send `{ auth: { token: <accessToken> } }` in the handshake.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('Missing token');
      const payload = await verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.username = payload.username;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;

    // Personal room + rooms for every conversation the user belongs to.
    await socket.join(`user:${userId}`);
    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    await socket.join(memberships.map((m) => `conv:${m.conversationId}`));

    await prisma.user.update({ where: { id: userId }, data: { online: true, lastSeenAt: null } });
    await broadcastPresence(io, userId, true);

    socket.on(EVENTS.TYPING, async (payload: TypingPayload, cb?: (ok: boolean) => void) => {
      const member = await prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: payload.conversationId,
            userId,
          },
        },
        select: { id: true },
      });
      if (!member) {
        cb?.(false);
        return;
      }
      socket
        .to(`conv:${payload.conversationId}`)
        .emit(EVENTS.TYPING, {
          conversationId: payload.conversationId,
          userId,
          typing: Boolean(payload.typing),
        });
      cb?.(true);
    });

    socket.on('disconnect', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { online: false, lastSeenAt: new Date() },
      });
      await broadcastPresence(io, userId, false);
    });
  });

  return io;
}

/** Notify a user's accepted friends that their online status changed. */
async function broadcastPresence(io: Server, userId: string, online: boolean): Promise<void> {
  const friendships = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ senderId: userId }, { receiverId: userId }] },
    select: { senderId: true, receiverId: true },
  });
  const friendIds = friendships.map((f) =>
    f.senderId === userId ? f.receiverId : f.senderId,
  );
  for (const friendId of friendIds) {
    io.to(`user:${friendId}`).emit(EVENTS.PRESENCE_UPDATE, { userId, online });
  }
}
