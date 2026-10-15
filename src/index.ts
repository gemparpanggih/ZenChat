import { createServer } from 'node:http';
import { createApp } from './app.js';
import { prisma } from './config/db.js';
import { env } from './config/env.js';
import { attachSocket } from './socket/index.js';

async function main() {
  const app = createApp();
  const server = createServer(app);
  attachSocket(server);

  server.listen(env.PORT, () => {
    console.log(`🚀 ZenChat listening on http://localhost:${env.PORT}`);
    console.log(`   Health check: http://localhost:${env.PORT}/health`);
    if (env.NODE_ENV === 'production' && env.CLIENT_ORIGIN === '*') {
      console.warn(
        '   ⚠️  CLIENT_ORIGIN is "*" in production — any origin can read API responses. ' +
          'Set CLIENT_ORIGIN to your client origin(s) (comma-separated).',
      );
    }
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down...`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
