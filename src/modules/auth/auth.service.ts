import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { conflictError, unauthorizedError } from '../../lib/ApiError.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { pickPublicUser, publicUserSelect } from '../../lib/select.js';
import {
  hashToken,
  parseDurationToMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../lib/token.js';
import type { User } from '@prisma/client';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

async function issueTokens(user: User): Promise<Tokens> {
  const accessToken = await signAccessToken(user);
  const refreshToken = await signRefreshToken(user.id);
  const expiresAt = new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN));
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt },
  });
  return { accessToken, refreshToken };
}

export async function register(input: {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { id: true },
  });
  if (existing) throw conflictError('Email or username is already in use');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      displayName: input.displayName,
    },
    select: publicUserSelect,
  });
  const tokens = await issueTokens(user as User);
  return { user, ...tokens };
}

export async function login(input: { identifier: string; password: string }) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: input.identifier }, { username: input.identifier }] },
  });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw unauthorizedError('Invalid email/username or password');
  }
  const tokens = await issueTokens(user);
  return { user: pickPublicUser(user), ...tokens };
}

export async function refresh(refreshToken: string) {
  try {
    await verifyRefreshToken(refreshToken);
  } catch {
    throw unauthorizedError('Invalid refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw unauthorizedError('Invalid refresh token');
  }

  // Rotation: the old token is single-use.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  const tokens = await issueTokens(stored.user);
  return { user: pickPublicUser(stored.user), ...tokens };
}

export async function revoke(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revoked: false },
    data: { revoked: true },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw unauthorizedError('User not found');
  return user;
}
