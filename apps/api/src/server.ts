import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createPgDb } from './db/db.ts';

/** Process entry point: config from the environment, one pool, graceful shutdown. */
const config = loadConfig(process.env);
const db = createPgDb(config.DATABASE_URL, config.DATABASE_POOL_MAX);
const app = await buildApp(config, db);

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
