import type { NextFunction, Request, Response } from 'express';
import { ApiError, unauthorizedError } from '../lib/ApiError.js';
import { verifyAccessToken } from '../lib/token.js';

/** Requires a valid `Authorization: Bearer <token>` header; sets `req.user`. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw unauthorizedError('Missing bearer token');
    }
    const token = header.slice('Bearer '.length);
    const payload = await verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, username: payload.username };
    next();
  } catch (err) {
    next(err instanceof ApiError ? err : unauthorizedError('Invalid or expired token'));
  }
}
