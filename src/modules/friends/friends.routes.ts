import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
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
friendsRouter.post('/requests', validate(sendRequestSchema), c.sendRequest);
friendsRouter.patch('/requests/:friendshipId', validate(respondSchema), c.respond);
friendsRouter.delete('/:friendId', validate(friendIdSchema), c.remove);
