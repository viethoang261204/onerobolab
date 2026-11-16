import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.ts';

/** GET /health — liveness + database connectivity (Render health check). */
export function registerHealthRoute(app: FastifyInstance, { db }: AppDeps) {
  app.get('/health', { config: { rateLimit: false } }, async (_req, reply) => {
    try {
      await db.ping();
      return { status: 'ok', database: 'ok' };
    } catch {
      return reply.status(503).send({ status: 'degraded', database: 'unreachable' });
    }
  });
}
