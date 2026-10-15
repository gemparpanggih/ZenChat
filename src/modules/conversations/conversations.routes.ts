import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as c from './conversations.controller.js';
import {
  addMembersSchema,
  createConversationSchema,
  getConversationSchema,
  listConversationsSchema,
  removeMemberSchema,
  renameConversationSchema,
} from './conversations.schemas.js';

export const conversationsRouter = Router();

conversationsRouter.use(requireAuth);

conversationsRouter.post('/', validate(createConversationSchema), c.create);
conversationsRouter.get('/', validate(listConversationsSchema), c.list);
conversationsRouter.post('/:id/read', validate(getConversationSchema), c.markRead);
conversationsRouter.patch('/:id', validate(renameConversationSchema), c.rename);
conversationsRouter.post('/:id/members', validate(addMembersSchema), c.addMembers);
conversationsRouter.delete('/:id/members/:userId', validate(removeMemberSchema), c.removeMember);
conversationsRouter.delete('/:id/leave', validate(getConversationSchema), c.leave);
conversationsRouter.get('/:id', validate(getConversationSchema), c.getById);
