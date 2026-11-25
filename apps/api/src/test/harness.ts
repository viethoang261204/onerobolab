import type { PGlite } from '@electric-sql/pglite';
import { serializeProgram } from '@robolab/blocks';
import { buildProgram, left, right, step, stop, type Spec } from '@robolab/blocks/test-utils';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.ts';
import { loadConfig } from '../config.ts';
import type { Db } from '../db/db.ts';
import { createMemoryDb, setSeedPasswords } from '../dev/memory-db.ts';
import type { Program } from '../domain/program.ts';

/*
 * Test harness: a real PostgreSQL (PGlite, in-process WASM) loaded with
 * database/schema.sql + seed.sql, wrapped in the same `Db` interface the
 * production pg pool implements. Nothing is mocked below the HTTP layer.
 */

/** Test-only passwords (set at runtime; the seed only has placeholders). */
export const PASSWORDS = { admin: 'Admin-Test-Pass-1', student: 'Student-Test-Pass-1' } as const;

export interface TestContext {
  app: FastifyInstance;
  db: Db;
  pg: PGlite;
  /** Signs in and returns the bearer token. */
  login(username: string, password?: string): Promise<string>;
  /** Id of a user by username. */
  userId(username: string): Promise<string>;
  levelId(slug: string): Promise<string>;
  close(): Promise<void>;
}

/** Fresh database + app. `env` overrides config (e.g. a low login rate limit). */
export async function createTestContext(env: Record<string, string> = {}): Promise<TestContext> {
  const { db, pg } = await createMemoryDb();
  await setSeedPasswords(db, PASSWORDS);
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'pglite://memory',
    AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    CORS_ORIGIN: 'http://localhost:5173',
    LOGIN_RATE_LIMIT: '1000',
    ...env,
  });
  const app = await buildApp(config, db);
  await app.ready();

  return {
    app,
    db,
    pg,
    async login(username, password) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username, password: password ?? (username === 'admin' ? PASSWORDS.admin : PASSWORDS.student) },
      });
      if (res.statusCode !== 200) throw new Error(`login ${username} failed: ${res.statusCode} ${res.body}`);
      return res.json<{ token: string }>().token;
    },
    async userId(username) {
      const { rows } = await db.query<{ id: string }>('SELECT id FROM users WHERE username_normalized = $1', [username.toLowerCase()]);
      return rows[0]!.id;
    },
    async levelId(slug) {
      const { rows } = await db.query<{ id: string }>('SELECT id FROM levels WHERE slug = $1 AND deleted_at IS NULL', [slug]);
      return rows[0]!.id;
    },
    async close() {
      await app.close();
      await db.close();
    },
  };
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

/** A valid block program: start → forward(cm) [→ more blocks]. */
export function straightProgram(distanceCm: number, extra: Record<string, unknown>[] = []) {
  const blocks: Record<string, unknown> = {
    start: { id: 'start', type: 'event.start', fields: {}, inputs: {}, slots: {}, next: 'b1' },
    b1: { id: 'b1', type: 'motion.forward', fields: { distance: distanceCm }, inputs: { distance: null }, slots: {}, next: extra.length ? 'x0' : null },
  };
  extra.forEach((b, i) => {
    blocks[`x${i}`] = { id: `x${i}`, fields: {}, inputs: {}, slots: {}, next: i + 1 < extra.length ? `x${i + 1}` : null, ...b };
  });
  return { format: 'roboverse.blocks', version: 1, blocks, roots: [{ id: 'start', x: 40, y: 28 }], variables: [] };
}

/** Solving block stacks for the seeded levels (mirroring `apps/web/src/features/levels/reference-solutions.ts`). */
const SEEDED_SOLUTIONS: Readonly<Record<string, readonly Spec[]>> = {
  'starter-01': [step(3), left(90), step(2), stop()],
  'starter-02': [step(2), left(90), step(2), right(90), step(3), right(90), step(1), stop()],
};

/** A real solving block program (stored JSON format) for a seeded level slug. */
export function solutionProgram(slug: string): Program {
  const stack = SEEDED_SOLUTIONS[slug];
  if (!stack) throw new Error(`No seeded test solution defined for level "${slug}".`);
  return JSON.parse(serializeProgram(buildProgram(stack, []))) as Program;
}
