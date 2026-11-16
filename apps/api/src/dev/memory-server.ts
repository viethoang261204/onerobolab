import { randomBytes } from 'node:crypto';
import { buildApp } from '../app.ts';
import { loadConfig } from '../config.ts';
import { createMemoryDb, setSeedPasswords } from './memory-db.ts';

/**
 * `pnpm dev:memory` — the real API on an in-memory, freshly seeded database,
 * for working on the web app / admin without Neon. Data is lost on exit.
 *
 * Passwords are random per run and printed once (set DEV_ADMIN_PASSWORD /
 * DEV_STUDENT_PASSWORD to choose them). Refuses to run in production.
 */
if (process.env.NODE_ENV === 'production') {
  console.error('dev:memory is for local development only.');
  process.exit(1);
}

const random = () => randomBytes(9).toString('base64url');
const passwords = { admin: process.env.DEV_ADMIN_PASSWORD ?? random(), student: process.env.DEV_STUDENT_PASSWORD ?? random() };

const config = loadConfig({
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: 'pglite://memory',
  AUTH_SECRET: process.env.AUTH_SECRET ?? randomBytes(32).toString('base64url'),
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
});
const { db } = await createMemoryDb();
await setSeedPasswords(db, passwords);
const app = await buildApp(config, db);
await app.listen({ host: '127.0.0.1', port: config.PORT });

console.log(`OneRoboLab API (in-memory database) on http://127.0.0.1:${config.PORT}`);
console.log(`  admin                                  / ${passwords.admin}`);
console.log(`  nguyenvana01 · tranthib02 · leminhc03 / ${passwords.student}`);

const stop = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
