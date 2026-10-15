import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { badRequestError } from '../lib/ApiError.js';

/**
 * Validates a request against a Zod schema shaped as
 * `{ body?, query?, params? }`. Parsed (coerced) values are attached to
 * `req.validated` so downstream handlers can trust the data.
 *
 * Note: we intentionally do NOT reassign `req.query`/`req.params` because
 * Express 5 exposes `query` as a getter that cannot be safely reassigned.
 */
export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      return next(badRequestError('Validation failed', result.error.flatten()));
    }
    req.validated = result.data as { body: any; query: any; params: any };
    next();
  };
}
