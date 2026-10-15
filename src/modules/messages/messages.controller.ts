import type { Request, Response } from 'express';
import * as messagesService from './messages.service.js';

export async function list(req: Request, res: Response) {
  const { conversationId } = req.validated!.params;
  const { query } = req.validated!;
  const result = await messagesService.listMessages(req.user!.id, conversationId, query);
  res.json(result);
}

export async function send(req: Request, res: Response) {
  const { conversationId } = req.validated!.params;
  const { content } = req.validated!.body;
  const message = await messagesService.sendMessage(req.user!.id, conversationId, content);
  res.status(201).json({ message });
}

export async function update(req: Request, res: Response) {
  const { messageId } = req.validated!.params;
  const { content } = req.validated!.body;
  const message = await messagesService.updateMessage(req.user!.id, messageId, content);
  res.json({ message });
}

export async function remove(req: Request, res: Response) {
  const { messageId } = req.validated!.params;
  const result = await messagesService.deleteMessage(req.user!.id, messageId);
  res.json(result);
}
