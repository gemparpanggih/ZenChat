import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/db.js';

export const app = createApp();

export interface TestUser {
  id: string;
  email: string;
  username: string;
  accessToken: string;
  refreshToken: string;
}

export function registerUser(
  email: string,
  username: string,
  password = 'password123',
): Promise<TestUser> {
  return request(app)
    .post('/api/auth/register')
    .send({ email, username, password })
    .expect(201)
    .then((res) => ({
      id: res.body.user.id as string,
      email,
      username,
      accessToken: res.body.accessToken as string,
      refreshToken: res.body.refreshToken as string,
    }));
}

export function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function resetDb(): Promise<void> {
  await prisma.readReceipt.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}
