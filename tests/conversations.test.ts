import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, auth, registerUser, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
});

describe('conversations & messages', () => {
  it('creates and reuses a direct conversation', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const bob = await registerUser('bob@example.com', 'bob');

    const res1 = await request(app)
      .post('/api/conversations')
      .set(auth(alice.accessToken))
      .send({ type: 'DIRECT', participantIds: [bob.id] })
      .expect(201);
    expect(res1.body.created).toBe(true);
    expect(res1.body.conversation.members).toHaveLength(2);

    const res2 = await request(app)
      .post('/api/conversations')
      .set(auth(alice.accessToken))
      .send({ type: 'DIRECT', participantIds: [bob.id] })
      .expect(200);
    expect(res2.body.created).toBe(false);
    expect(res2.body.conversation.id).toBe(res1.body.conversation.id);
  });

  it('sends and lists messages, then marks them read', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const bob = await registerUser('bob@example.com', 'bob');

    const conv = await request(app)
      .post('/api/conversations')
      .set(auth(alice.accessToken))
      .send({ type: 'DIRECT', participantIds: [bob.id] })
      .expect(201);
    const convId = conv.body.conversation.id as string;

    await request(app)
      .post(`/api/messages/conversations/${convId}`)
      .set(auth(alice.accessToken))
      .send({ content: 'Hello Bob' })
      .expect(201);

    const list = await request(app)
      .get(`/api/messages/conversations/${convId}`)
      .set(auth(bob.accessToken))
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].content).toBe('Hello Bob');
    expect(list.body.items[0].sender.username).toBe('alice');

    // Bob's unread count before reading.
    const before = await request(app)
      .get('/api/conversations')
      .set(auth(bob.accessToken))
      .expect(200);
    const bobsConv = before.body.items.find((i: any) => i.conversation.id === convId);
    expect(bobsConv.unreadCount).toBe(1);

    await request(app).post(`/api/conversations/${convId}/read`).set(auth(bob.accessToken)).expect(200);

    const after = await request(app)
      .get('/api/conversations')
      .set(auth(bob.accessToken))
      .expect(200);
    const bobsConvAfter = after.body.items.find((i: any) => i.conversation.id === convId);
    expect(bobsConvAfter.unreadCount).toBe(0);
  });

  it('lets a sender edit and delete their own message', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const bob = await registerUser('bob@example.com', 'bob');

    const conv = await request(app)
      .post('/api/conversations')
      .set(auth(alice.accessToken))
      .send({ type: 'DIRECT', participantIds: [bob.id] })
      .expect(201);
    const convId = conv.body.conversation.id as string;

    const sent = await request(app)
      .post(`/api/messages/conversations/${convId}`)
      .set(auth(alice.accessToken))
      .send({ content: 'original' })
      .expect(201);
    const msgId = sent.body.message.id as string;

    const edited = await request(app)
      .patch(`/api/messages/${msgId}`)
      .set(auth(alice.accessToken))
      .send({ content: 'edited' })
      .expect(200);
    expect(edited.body.message.content).toBe('edited');
    expect(edited.body.message.edited).toBe(true);

    await request(app).delete(`/api/messages/${msgId}`).set(auth(alice.accessToken)).expect(200);

    const list = await request(app)
      .get(`/api/messages/conversations/${convId}`)
      .set(auth(bob.accessToken))
      .expect(200);
    expect(list.body.items).toHaveLength(0);
  });

  it("prevents a non-sender from editing someone else's message", async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const bob = await registerUser('bob@example.com', 'bob');

    const conv = await request(app)
      .post('/api/conversations')
      .set(auth(alice.accessToken))
      .send({ type: 'DIRECT', participantIds: [bob.id] })
      .expect(201);
    const convId = conv.body.conversation.id as string;

    const sent = await request(app)
      .post(`/api/messages/conversations/${convId}`)
      .set(auth(alice.accessToken))
      .send({ content: 'private' })
      .expect(201);
    const msgId = sent.body.message.id as string;

    await request(app)
      .patch(`/api/messages/${msgId}`)
      .set(auth(bob.accessToken))
      .send({ content: 'hacked' })
      .expect(403);
  });
});

describe('group conversations', () => {
  it('requires a name and at least two members', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const bob = await registerUser('bob@example.com', 'bob');

    await request(app)
      .post('/api/conversations')
      .set(auth(alice.accessToken))
      .send({ type: 'GROUP', participantIds: [bob.id] })
      .expect(400);

    await request(app)
      .post('/api/conversations')
      .set(auth(alice.accessToken))
      .send({ type: 'GROUP', participantIds: [], name: 'Solo' })
      .expect(400);

    const res = await request(app)
      .post('/api/conversations')
      .set(auth(alice.accessToken))
      .send({ type: 'GROUP', participantIds: [bob.id], name: 'Dev Team' })
      .expect(201);
    expect(res.body.conversation.type).toBe('GROUP');
  });

  it('only allows the owner/admin to rename or add members', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const bob = await registerUser('bob@example.com', 'bob');
    const carol = await registerUser('carol@example.com', 'carol');

    const conv = await request(app)
      .post('/api/conversations')
      .set(auth(alice.accessToken))
      .send({ type: 'GROUP', participantIds: [bob.id], name: 'Team' })
      .expect(201);
    const convId = conv.body.conversation.id as string;

    // Bob (member) cannot rename.
    await request(app)
      .patch(`/api/conversations/${convId}`)
      .set(auth(bob.accessToken))
      .send({ name: 'Hijacked' })
      .expect(403);

    // Alice (owner) can rename.
    const renamed = await request(app)
      .patch(`/api/conversations/${convId}`)
      .set(auth(alice.accessToken))
      .send({ name: 'Renamed Team' })
      .expect(200);
    expect(renamed.body.conversation.name).toBe('Renamed Team');

    // Alice adds Carol.
    const added = await request(app)
      .post(`/api/conversations/${convId}/members`)
      .set(auth(alice.accessToken))
      .send({ userIds: [carol.id] })
      .expect(200);
    expect(added.body.conversation.members).toHaveLength(3);

    // Carol can now see the conversation in her list.
    const carolList = await request(app)
      .get('/api/conversations')
      .set(auth(carol.accessToken))
      .expect(200);
    expect(carolList.body.items.some((i: any) => i.conversation.id === convId)).toBe(true);
  });

  it('lets a member leave and the owner remove a member', async () => {
    const alice = await registerUser('alice@example.com', 'alice');
    const bob = await registerUser('bob@example.com', 'bob');

    const conv = await request(app)
      .post('/api/conversations')
      .set(auth(alice.accessToken))
      .send({ type: 'GROUP', participantIds: [bob.id], name: 'Team' })
      .expect(201);
    const convId = conv.body.conversation.id as string;

    await request(app).delete(`/api/conversations/${convId}/leave`).set(auth(bob.accessToken)).expect(204);

    // Bob can no longer fetch the conversation.
    await request(app)
      .get(`/api/conversations/${convId}`)
      .set(auth(bob.accessToken))
      .expect(404);

    // Re-add Carol so there is someone to remove.
    const carol = await registerUser('carol@example.com', 'carol');
    await request(app)
      .post(`/api/conversations/${convId}/members`)
      .set(auth(alice.accessToken))
      .send({ userIds: [carol.id] })
      .expect(200);

    await request(app)
      .delete(`/api/conversations/${convId}/members/${carol.id}`)
      .set(auth(alice.accessToken))
      .expect(200);

    const convAfter = await request(app)
      .get(`/api/conversations/${convId}`)
      .set(auth(alice.accessToken))
      .expect(200);
    const memberIds = convAfter.body.conversation.members.map((m: any) => m.userId);
    expect(memberIds).not.toContain(carol.id);
  });
});
