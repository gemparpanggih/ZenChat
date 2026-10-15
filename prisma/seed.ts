import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword('password123');

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      username: 'alice',
      displayName: 'Alice',
      passwordHash,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      username: 'bob',
      displayName: 'Bob',
      passwordHash,
    },
  });

  const direct = await prisma.conversation.findFirst({
    where: { type: 'DIRECT', members: { every: { userId: { in: [alice.id, bob.id] } } } },
  });

  const conversation =
    direct ??
    (await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        createdById: alice.id,
        members: {
          create: [
            { userId: alice.id, role: 'OWNER' },
            { userId: bob.id, role: 'MEMBER' },
          ],
        },
      },
    }));

  await prisma.message.createMany({
    data: [
      { conversationId: conversation.id, senderId: alice.id, content: 'Hey Bob! 👋' },
      { conversationId: conversation.id, senderId: bob.id, content: 'Hey Alice, how are you?' },
      { conversationId: conversation.id, senderId: alice.id, content: 'Building a chat API 🚀' },
    ],
  });

  console.log('✅ Seed complete');
  console.log('   Users: alice@example.com / bob@example.com (password: password123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
