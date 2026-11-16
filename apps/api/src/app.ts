import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { authenticate, Permissions } from './auth/guard.ts';
import { SessionService } from './auth/sessions.ts';
import type { Config } from './config.ts';
import type { Db } from './db/db.ts';
import { errorHandler } from './http/errors.ts';
import { registerAdminActivityRoutes } from './routes/admin-activity.ts';
import { registerAdminContentRoutes } from './routes/admin-content.ts';
import { registerAdminCurriculumRoutes } from './routes/admin-curriculum.ts';
import { registerAdminStudentRoutes } from './routes/admin-students.ts';
import { registerAdminWorkflowRoutes } from './routes/admin-workflow.ts';
import { registerAuthRoutes, registerLoginRoute } from './routes/auth.ts';
import { registerHealthRoute } from './routes/health.ts';
import { registerStudentJourneyRoutes } from './routes/student-journey.ts';
import { registerStudentRoutes } from './routes/student.ts';

/** Everything a route module needs (created once per app). */
export interface AppDeps {
  readonly config: Config;
  readonly db: Db;
  readonly sessions: SessionService;
  readonly permissions: Permissions;
}

/** Hard cap for any request body (programs have their own, smaller limit). */
const BODY_LIMIT = 512 * 1024;

/**
 * Builds the API. Layout:
 *   /health                         public
 *   /api/auth/login                 public, rate limited
 *   /api/auth/*  /api/**            bearer session required
 *   /api/admin/**                   + role permission (role_permissions table)
 */
export async function buildApp(config: Config, db: Db): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : { level: config.LOG_LEVEL, redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], censor: '[redacted]' } },
    // Render terminates TLS in front of the app: trust X-Forwarded-For for req.ip.
    trustProxy: true,
    bodyLimit: BODY_LIMIT,
    genReqId: () => randomUUID(),
    ajv: { customOptions: { removeAdditional: false } },
  });

  await app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } });
  await app.register(cors, {
    origin: (origin, cb) => {
      // Non-browser clients send no Origin; browsers must be on the allow-list.
      if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) cb(null, true);
      else cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
    maxAge: 600,
  });
  // A generous global limit per IP; login has its own strict limit.
  await app.register(rateLimit, { global: true, max: 600, timeWindow: '1 minute' });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }));

  const deps: AppDeps = { config, db, sessions: new SessionService(config.AUTH_SECRET, config.SESSION_TTL_HOURS), permissions: new Permissions(db) };

  registerHealthRoute(app, deps);
  registerLoginRoute(app, deps);
  await app.register(async (secured) => {
    secured.addHook('onRequest', authenticate(db, deps.sessions));
    registerAuthRoutes(secured, deps);
    registerStudentRoutes(secured, deps);
    registerStudentJourneyRoutes(secured, deps);
    registerAdminStudentRoutes(secured, deps);
    registerAdminCurriculumRoutes(secured, deps);
    registerAdminContentRoutes(secured, deps);
    registerAdminWorkflowRoutes(secured, deps);
    registerAdminActivityRoutes(secured, deps);
  });
  return app;
}
