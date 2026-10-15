import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const RATE_LIMIT_MESSAGE = {
  error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
};

// Disabled in tests so the integration suite is not throttled.
const skip = () => env.NODE_ENV === 'test';

/** Login / register / refresh: tight window to stop credential brute-force. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 requests per window per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: RATE_LIMIT_MESSAGE,
});

/** General API catch-all. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: RATE_LIMIT_MESSAGE,
});

/** Mutating/spam-prone endpoints (sending messages, friend requests, group ops). */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 60, // 60 requests per minute per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: RATE_LIMIT_MESSAGE,
});
