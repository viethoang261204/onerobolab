import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createPgDb } from './db/db.ts';
import { createMemoryDb, setSeedPasswords } from './dev/memory-db.ts';

/** Process entry point: config from the environment, pg pool or in-memory PGlite fallback, graceful shutdown. */
const config = loadConfig(process.env);
const db = config.DATABASE_URL
  ? createPgDb(config.DATABASE_URL, config.DATABASE_POOL_MAX)
  : await (async () => {
      const mem = await createMemoryDb();
      await setSeedPasswords(mem.db, {
        admin: process.env.DEV_ADMIN_PASSWORD ?? 'Admin12345!',
        student: process.env.DEV_STUDENT_PASSWORD ?? '12345678',
      });
      return mem.db;
    })();
const app = await buildApp(config, db);
if (!config.DATABASE_URL) {
  app.log.warn('DATABASE_URL not set — running on seeded in-memory PGlite database');
}

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, 'shutting down');
  try {
    await app.close();
    await db.close();
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'shutdown failed');
    process.exit(1);
  }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (err) {
  app.log.error({ err }, 'failed to start');
  await db.close();
  process.exit(1);
}
