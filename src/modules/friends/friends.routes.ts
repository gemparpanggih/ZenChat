import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { strictLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as c from './friends.controller.js';
import {
  friendIdSchema,
  listFriendsSchema,
  respondSchema,
  sendRequestSchema,
} from './friends.schemas.js';

export const friendsRouter = Router();

friendsRouter.use(requireAuth);

friendsRouter.get('/', validate(listFriendsSchema), c.list);
friendsRouter.post('/requests', strictLimiter, validate(sendRequestSchema), c.sendRequest);
friendsRouter.patch('/requests/:friendshipId', strictLimiter, validate(respondSchema), c.respond);
friendsRouter.delete('/:friendId', strictLimiter, validate(friendIdSchema), c.remove);
