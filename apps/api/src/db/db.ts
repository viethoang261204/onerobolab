import pg from 'pg';

export type Row = Record<string, unknown>;

/** Anything that can run a parameterised query (pool, transaction client, test DB). */
export interface Queryable {
  query<T = Row>(text: string, params?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}

/** The API's only database surface: parameterised queries + transactions. */
export interface Db extends Queryable {
  /** Runs `fn` in one transaction (COMMIT on success, ROLLBACK on throw). */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

// Return BIGINT (e.g. count(*)) as JS numbers — values here are always small.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
// NUMERIC columns (times, star averages) as numbers too.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));

/**
 * node-postgres pool from DATABASE_URL. Every statement is parameterised
 * ($1, $2 …) — SQL text is never built from user input.
 */
export function createPgDb(connectionString: string, max = 10): Db {
  const pool = new pg.Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Neon requires TLS; the connection string carries sslmode=require.
  });
  const wrap = (c: pg.Pool | pg.PoolClient): Queryable => ({
    async query<T>(text: string, params: readonly unknown[] = []) {
      const r = await c.query(text, params as unknown[]);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
    },
  });
  const root = wrap(pool);
  return {
    query: root.query,
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
    async ping() {
      await pool.query('SELECT 1');
    },
    close: () => pool.end(),
  };
}
