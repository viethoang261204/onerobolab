import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../auth/passwords.ts';
import type { Db, Queryable, Row } from '../db/db.ts';

/*
 * In-process PostgreSQL (PGlite, WASM) loaded with database/schema.sql +
 * seed.sql, behind the same `Db` interface as the production pg pool.
 * Used by the tests and by `pnpm dev:memory` — never in production.
 */

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const SCHEMA = readFileSync(`${root}database/schema.sql`, 'utf8');
const SEED = readFileSync(`${root}database/seed.sql`, 'utf8');

const INT8 = 20;
const NUMERIC = 1700;

function wrap(pg: PGlite): Db {
  const q = (c: Pick<PGlite, 'query'>): Queryable => ({
    async query<T = Row>(text: string, params: readonly unknown[] = []) {
      const r = await c.query<T>(text, params as unknown[]);
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
    },
  });
  return {
    ...q(pg),
    tx: (fn) => pg.transaction((t) => fn(q(t))),
    ping: async () => void (await pg.query('SELECT 1')),
    close: () => pg.close(),
  };
}

/** A fresh seeded database. Seeded accounts keep placeholder hashes until `setSeedPasswords`. */
export async function createMemoryDb(): Promise<{ db: Db; pg: PGlite }> {
  const pg = new PGlite({ extensions: { pgcrypto }, parsers: { [INT8]: Number, [NUMERIC]: Number } });
  await pg.exec(SCHEMA);
  await pg.exec(SEED);
  return { db: wrap(pg), pg };
}

/** Real Argon2id hashes for the seeded accounts (admin vs students); no forced first-login change. */
export async function setSeedPasswords(db: Db, passwords: { admin: string; student: string }): Promise<void> {
  const [adminHash, studentHash] = await Promise.all([hashPassword(passwords.admin), hashPassword(passwords.student)]);
  await db.query(`UPDATE users SET password_hash = CASE WHEN role = 'STUDENT' THEN $2 ELSE $1 END, must_change_password = FALSE`, [adminHash, studentHash]);
}
