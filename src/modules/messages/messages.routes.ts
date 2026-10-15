import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { strictLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as c from './messages.controller.js';
import {
  listMessagesSchema,
  messageIdSchema,
  sendMessageSchema,
  updateMessageSchema,
} from './messages.schemas.js';

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

messagesRouter.get('/conversations/:conversationId', validate(listMessagesSchema), c.list);
messagesRouter.post('/conversations/:conversationId', strictLimiter, validate(sendMessageSchema), c.send);
messagesRouter.patch('/:messageId', strictLimiter, validate(updateMessageSchema), c.update);
messagesRouter.delete('/:messageId', strictLimiter, validate(messageIdSchema), c.remove);
