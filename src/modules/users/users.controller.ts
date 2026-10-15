import type { Request, Response } from 'express';
import { publicUrl } from '../../middleware/upload.js';
import * as usersService from './users.service.js';

export async function search(req: Request, res: Response) {
  const { q, limit } = req.validated!.query;
  const users = await usersService.searchUsers(q, req.user!.id, limit);
  res.json({ users });
}

export async function getById(req: Request, res: Response) {
  const { id } = req.validated!.params;
  const user = await usersService.getUserById(id);
  res.json({ user });
}

export async function updateMe(req: Request, res: Response) {
  const { body } = req.validated!;
  const user = await usersService.updateMe(req.user!.id, body);
  res.json({ user });
}

export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'No file uploaded' } });
    return;
  }
  const user = await usersService.setAvatar(req.user!.id, publicUrl(req.file.filename));
  res.json({ user, avatarUrl: user.avatarUrl });
}
