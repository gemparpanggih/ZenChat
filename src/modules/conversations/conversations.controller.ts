import type { Request, Response } from 'express';
import * as conversationsService from './conversations.service.js';

export async function create(req: Request, res: Response) {
  const { body } = req.validated!;
  const result = await conversationsService.createConversation(req.user!.id, body);
  res.status(result.created ? 201 : 200).json({ conversation: result.conversation, created: result.created });
}

export async function list(req: Request, res: Response) {
  const { query } = req.validated!;
  const result = await conversationsService.listConversations(req.user!.id, query);
  res.json(result);
}

export async function getById(req: Request, res: Response) {
  const { id } = req.validated!.params;
  const conversation = await conversationsService.getConversationById(req.user!.id, id);
  res.json({ conversation });
}

export async function rename(req: Request, res: Response) {
  const { id } = req.validated!.params;
  const { name } = req.validated!.body;
  const conversation = await conversationsService.renameGroup(req.user!.id, id, name);
  res.json({ conversation });
}

export async function addMembers(req: Request, res: Response) {
  const { id } = req.validated!.params;
  const { userIds } = req.validated!.body;
  const conversation = await conversationsService.addMembers(req.user!.id, id, userIds);
  res.json({ conversation });
}

export async function removeMember(req: Request, res: Response) {
  const { id, userId } = req.validated!.params;
  const conversation = await conversationsService.removeMember(req.user!.id, id, userId);
  res.json({ conversation });
}

export async function leave(req: Request, res: Response) {
  const { id } = req.validated!.params;
  await conversationsService.leaveConversation(req.user!.id, id);
  res.status(204).end();
}

export async function markRead(req: Request, res: Response) {
  const { id } = req.validated!.params;
  const result = await conversationsService.markConversationRead(req.user!.id, id);
  res.json(result);
}
