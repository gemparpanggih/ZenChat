import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, auth, registerUser, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
});

function makeImage(ext: string, content: string): { filename: string; content: Buffer } {
  return { filename: `test${ext}`, content: Buffer.from(content) };
}

describe('security: uploads', () => {
  it('rejects active-content files (stored XSS vector)', async () => {
    const alice = await registerUser('alice@example.com', 'alice');

    // HTML disguised as an image — the mimetype lies, but the extension must not pass.
    const evilHtml = makeImage('.html', '<html><script>alert(1)</script></html>');
    await request(app)
      .post('/api/users/me/avatar')
      .set(auth(alice.accessToken))
      .attach('avatar', evilHtml.content, { filename: evilHtml.filename, contentType: 'image/png' })
      .expect(400);

    // SVG can carry scripts too.
    const evilSvg = makeImage('.svg', '<svg onload="alert(1)"></svg>');
    await request(app)
      .post('/api/users/me/avatar')
      .set(auth(alice.accessToken))
      .attach('avatar', evilSvg.content, { filename: evilSvg.filename, contentType: 'image/svg+xml' })
      .expect(400);
  });

  it('accepts a real image extension', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const res = await request(app)
      .post('/api/users/me/avatar')
      .set(auth(alice.accessToken))
      .attach('avatar', Buffer.from('png-bytes'), { filename: 'test.png', contentType: 'image/png' })
      .expect(200);
    expect(res.body.user.avatarUrl).toMatch(/^\/uploads\/.+\.png$/);
  });
});

describe('security: PII', () => {
  it('does not expose another user’s email in search or profile', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const bob = await registerUser('bob@example.com', 'bob');

    const search = await request(app)
      .get('/api/users?q=bob')
      .set(auth(alice.accessToken))
      .expect(200);
    expect(search.body.users).toHaveLength(1);
    expect(search.body.users[0]).not.toHaveProperty('email');

    const profile = await request(app)
      .get(`/api/users/${bob.id}`)
      .set(auth(alice.accessToken))
      .expect(200);
    expect(profile.body.user).not.toHaveProperty('email');
    expect(profile.body.user.username).toBe('bob');
  });

  it('still returns email for the user’s own profile', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const me = await request(app).get('/api/auth/me').set(auth(alice.accessToken)).expect(200);
    expect(me.body.user.email).toBe('alice@example.com');
  });
});

describe('security: message edit after leaving', () => {
  it('blocks editing a message after leaving the conversation', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const bob = await registerUser('bob@example.com', 'bob');

    const conv = await request(app)
      .post('/api/conversations')
      .set(auth(alice.accessToken))
      .send({ type: 'GROUP', participantIds: [bob.id], name: 'Team' })
      .expect(201);
    const convId = conv.body.conversation.id as string;

    const sent = await request(app)
      .post(`/api/messages/conversations/${convId}`)
      .set(auth(bob.accessToken))
      .send({ content: 'original' })
      .expect(201);
    const msgId = sent.body.message.id as string;

    await request(app).delete(`/api/conversations/${convId}/leave`).set(auth(bob.accessToken)).expect(204);

    await request(app)
      .patch(`/api/messages/${msgId}`)
      .set(auth(bob.accessToken))
      .send({ content: 'edited after leaving' })
      .expect(404);
  });
});
