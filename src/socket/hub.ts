import type { Server } from 'socket.io';

/**
 * Thin wrapper around the Socket.IO server used by REST services to push
 * real-time events. Every connected user joins the `user:{id}` room, and
 * every member of a conversation joins `conv:{conversationId}`.
 *
 * This is a singleton so services can emit without threading `io` through
 * the request pipeline. `init()` is called once from src/index.ts; in tests
 * the hub stays null-initialized and all calls become no-ops.
 */
export class SocketHub {
  private io: Server | null = null;

  init(io: Server): void {
    this.io = io;
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.io?.to(`user:${userId}`).emit(event, payload);
  }

  emitToConversation(conversationId: string, event: string, payload: unknown): void {
    this.io?.to(`conv:${conversationId}`).emit(event, payload);
  }

  /** Move a user's sockets into a conversation room (e.g. after being added). */
  addUserToConversation(userId: string, conversationId: string): void {
    this.io?.in(`user:${userId}`).socketsJoin(`conv:${conversationId}`);
  }

  /** Remove a user's sockets from a conversation room (leave/removal). */
  removeUserFromConversation(userId: string, conversationId: string): void {
    this.io?.in(`user:${userId}`).socketsLeave(`conv:${conversationId}`);
  }
}

export const hub = new SocketHub();
