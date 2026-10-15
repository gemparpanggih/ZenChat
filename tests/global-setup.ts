import { execSync } from 'node:child_process';

/**
 * Vitest global setup (runs once, in its own process).
 * Ensures the test SQLite database has the current schema before any test runs.
 */
export default function globalSetup() {
  process.env.DATABASE_URL = 'file:./test.db';
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
}
