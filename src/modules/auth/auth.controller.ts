import type { NextFunction, Request, Response } from 'express';
import * as authService from './auth.service.js';

export async function register(req: Request, res: Response) {
  const { body } = req.validated!;
  const result = await authService.register(body);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const { body } = req.validated!;
  const result = await authService.login(body);
  res.json(result);
}

export async function refresh(req: Request, res: Response) {
  const { body } = req.validated!;
  const result = await authService.refresh(body.refreshToken);
  res.json(result);
}

export async function logout(req: Request, res: Response) {
  const { body } = req.validated!;
  await authService.revoke(body.refreshToken);
  res.status(204).end();
}

export async function logoutAll(req: Request, res: Response) {
  await authService.revokeAll(req.user!.id);
  res.status(204).end();
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user!.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
