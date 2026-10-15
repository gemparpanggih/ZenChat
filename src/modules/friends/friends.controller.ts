import type { Request, Response } from 'express';
import * as friendsService from './friends.service.js';

export async function list(req: Request, res: Response) {
  const { status } = req.validated!.query;
  const friends = await friendsService.listFriends(req.user!.id, status);
  res.json({ friends });
}

export async function sendRequest(req: Request, res: Response) {
  const { userId } = req.validated!.body;
  const friendship = await friendsService.sendRequest(req.user!.id, userId);
  res.status(201).json({ friendship });
}

export async function respond(req: Request, res: Response) {
  const { friendshipId } = req.validated!.params;
  const { status } = req.validated!.body;
  const friendship = await friendsService.respond(req.user!.id, friendshipId, status);
  res.json({ friendship });
}

export async function remove(req: Request, res: Response) {
  const { friendId } = req.validated!.params;
  const result = await friendsService.removeFriend(req.user!.id, friendId);
  res.json(result);
}
