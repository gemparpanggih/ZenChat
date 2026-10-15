import { createHash, randomUUID } from 'node:crypto';import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
const ALG = 'HS256';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  username: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

export async function signAccessToken(user: {
  id: string;
  email: string;
  username: string;
}): Promise<string> {
  return new SignJWT({ email: user.email, username: user.username, type: 'access' })
    .setProtectedHeader({ alg: ALG })
    .setJti(randomUUID())
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
    .sign(accessSecret);
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ type: 'refresh' })
    .setProtectedHeader({ alg: ALG })
    .setJti(randomUUID())
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_EXPIRES_IN)
    .sign(refreshSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecret, { algorithms: [ALG] });
  if (payload.type !== 'access' || !payload.sub) throw new Error('Invalid access token');
  return payload as unknown as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, refreshSecret, { algorithms: [ALG] });
  if (payload.type !== 'refresh' || !payload.sub) throw new Error('Invalid refresh token');
  return payload as unknown as RefreshTokenPayload;
}

/** Store only a SHA-256 hash of refresh tokens in the DB. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Parse "15m", "7d", "1h" style durations into milliseconds. */
export function parseDurationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match || !match[1] || !match[2]) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * multipliers[unit]!;
}
