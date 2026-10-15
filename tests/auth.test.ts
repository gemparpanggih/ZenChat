import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, auth, registerUser, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
});

describe('POST /api/auth/register', () => {
  it('creates a user and returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@example.com', username: 'alice', password: 'password123' })
      .expect(201);

    expect(res.body.user).toMatchObject({ email: 'a@example.com', username: 'alice' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('rejects duplicate email', async () => {
    await registerUser('dup@example.com', 'dupuser');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', username: 'other', password: 'password123' })
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'x@example.com', username: 'xuser', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with email', async () => {
    await registerUser('login@example.com', 'loginuser');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'login@example.com', password: 'password123' })
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('logs in with username', async () => {
    await registerUser('login2@example.com', 'loginuser2');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'loginuser2', password: 'password123' })
      .expect(200);
    expect(res.body.user.username).toBe('loginuser2');
  });

  it('rejects a wrong password', async () => {
    await registerUser('bad@example.com', 'baduser');
    await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'bad@example.com', password: 'wrongpass' })
      .expect(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user with a valid token', async () => {
    const user = await registerUser('me@example.com', 'meuser');
    const res = await request(app).get('/api/auth/me').set(auth(user.accessToken)).expect(200);
    expect(res.body.user.email).toBe('me@example.com');
  });

  it('rejects a missing token', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token (old one becomes single-use)', async () => {
    const user = await registerUser('refresh@example.com', 'refreshuser');

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
    const newRefresh = res.body.refreshToken as string;
    expect(newRefresh).not.toBe(user.refreshToken);

    // Reusing the old token must fail now.
    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('rejects a garbage token', async () => {
    await request(app).post('/api/auth/refresh').send({ refreshToken: 'garbage' }).expect(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token', async () => {
    const user = await registerUser('logout@example.com', 'logoutuser');
    await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: user.refreshToken })
      .expect(204);

    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });
});
