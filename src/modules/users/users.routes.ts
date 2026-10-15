import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as c from './users.controller.js';
import { getByIdSchema, searchSchema, updateMeSchema } from './users.schemas.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get('/', validate(searchSchema), c.search);
usersRouter.patch('/me', validate(updateMeSchema), c.updateMe);
usersRouter.post('/me/avatar', upload.single('avatar'), c.uploadAvatar);
usersRouter.get('/:id', validate(getByIdSchema), c.getById);
