import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../lib/ApiError.js';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new ApiError(404, 'Route not found', 'NOT_FOUND'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Prisma known errors
  if (err?.code === 'P2002') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with this value already exists' } });
    return;
  }
  if (err?.code === 'P2025') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found' } });
    return;
  }

  // Multer upload errors
  if (err?.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({ error: { code: 'UPLOAD_ERROR', message: err.message } });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : err?.message ?? 'Unknown error',
    },
  });
};
