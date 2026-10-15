import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, auth, registerUser, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
});

describe('friends', () => {
  it('sends, accepts, and lists a friendship', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const bob = await registerUser('bob@example.com', 'bob');

    const req = await request(app)
      .post('/api/friends/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);
    const friendshipId = req.body.friendship.id as string;
    expect(req.body.friendship.status).toBe('PENDING');

    // Duplicate pending request is rejected.
    await request(app)
      .post('/api/friends/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(409);

    // Only the recipient can accept.
    await request(app)
      .patch(`/api/friends/requests/${friendshipId}`)
      .set(auth(alice.accessToken))
      .send({ status: 'ACCEPTED' })
      .expect(400);

    const accepted = await request(app)
      .patch(`/api/friends/requests/${friendshipId}`)
      .set(auth(bob.accessToken))
      .send({ status: 'ACCEPTED' })
      .expect(200);
    expect(accepted.body.friendship.status).toBe('ACCEPTED');

    const list = await request(app)
      .get('/api/friends')
      .set(auth(alice.accessToken))
      .expect(200);
    const mine = list.body.friends.find((f: any) => f.id === friendshipId);
    expect(mine.status).toBe('ACCEPTED');
  });

  it('removes a friendship', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const bob = await registerUser('bob@example.com', 'bob');

    const req = await request(app)
      .post('/api/friends/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);
    const friendshipId = req.body.friendship.id as string;

    await request(app)
      .patch(`/api/friends/requests/${friendshipId}`)
      .set(auth(bob.accessToken))
      .send({ status: 'ACCEPTED' })
      .expect(200);

    await request(app).delete(`/api/friends/${bob.id}`).set(auth(alice.accessToken)).expect(200);

    const list = await request(app).get('/api/friends').set(auth(alice.accessToken)).expect(200);
    expect(list.body.friends).toHaveLength(0);
  });

  it('cannot add yourself', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    await request(app)
      .post('/api/friends/requests')
      .set(auth(alice.accessToken))
      .send({ userId: alice.id })
      .expect(400);
  });
});

describe('users', () => {
  it('searches users by username', async () => {
    await registerUser('alice@example.com', 'alice');
    const bob = await registerUser('bob@example.com', 'bob');

    const res = await request(app)
      .get('/api/users?q=ali')
      .set(auth(bob.accessToken))
      .expect(200);
    const usernames = res.body.users.map((u: any) => u.username);
    expect(usernames).toContain('alice');
    expect(usernames).not.toContain('bob'); // self is excluded
  });

  it('updates the current profile', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const res = await request(app)
      .patch('/api/users/me')
      .set(auth(alice.accessToken))
      .send({ displayName: 'Alice In Chains', bio: 'hello' })
      .expect(200);
    expect(res.body.user.displayName).toBe('Alice In Chains');
  });

  it('rejects unauthenticated access', async () => {
    await request(app).get('/api/users?q=x').expect(401);
  });
});
