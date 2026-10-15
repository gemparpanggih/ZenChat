import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import { apiLimiter, authLimiter } from './middleware/rateLimit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { conversationsRouter } from './modules/conversations/conversations.routes.js';
import { friendsRouter } from './modules/friends/friends.routes.js';
import { messagesRouter } from './modules/messages/messages.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN === '*' ? true : env.CLIENT_ORIGIN.split(',') }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // Rate limiting (skipped in tests). Auth gets a tight window.
  app.use('/api', apiLimiter);
  app.use('/api/auth', authLimiter);

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/friends', friendsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
