import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
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
messagesRouter.post('/conversations/:conversationId', validate(sendMessageSchema), c.send);
messagesRouter.patch('/:messageId', validate(updateMessageSchema), c.update);
messagesRouter.delete('/:messageId', validate(messageIdSchema), c.remove);
