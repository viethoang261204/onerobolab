import type { Queryable } from '../db/db.ts';
import { notFound } from './errors.ts';
import { buildUpdate, type ColumnSpec } from './sql.ts';

/*
 * Small helpers for admin CRUD. Table / column names always come from code
 * (ColumnSpec maps); values are always bound parameters.
 */

/** `${select} AND alias.id = $1` → the row, or 404. `select` must end in a WHERE clause. */
export async function selectOne<T = Record<string, unknown>>(q: Queryable, select: string, alias: string, id: string, what: string, lock = false): Promise<T> {
  const { rows } = await q.query(`${select} AND ${alias}.id = $1${lock ? ` FOR UPDATE OF ${alias}` : ''}`, [id]);
  if (!rows[0]) throw notFound(what);
  return rows[0] as T;
}

/** INSERT the provided fields only (schema defaults for the rest); returns the new id. */
export async function insertRow(
  q: Queryable,
  table: string,
  cols: Readonly<Record<string, ColumnSpec>>,
  values: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const names: string[] = [];
  const holders: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, value: unknown, cast?: string) => {
    params.push(value);
    names.push(col);
    holders.push(`$${params.length}${cast ? `::${cast}` : ''}`);
  };
  for (const [key, spec] of Object.entries(cols)) {
    const v = values[key];
    if (v !== undefined) push(spec.col, spec.json && v !== null ? JSON.stringify(v) : v, spec.cast);
  }
  for (const [col, v] of Object.entries(extra)) push(col, v);
  const { rows } = await q.query<{ id: string }>(`INSERT INTO ${table} (${names.join(', ')}) VALUES (${holders.join(', ')}) RETURNING id`, params);
  return rows[0]!.id;
}

/** UPDATE only the provided fields of a non-deleted row. */
export async function patchRow(
  q: Queryable,
  table: string,
  cols: Readonly<Record<string, ColumnSpec>>,
  id: string,
  patch: Record<string, unknown>,
  extraSets: readonly string[] = [],
): Promise<void> {
  const { sets, params } = buildUpdate(cols, patch, 2);
  await q.query(`UPDATE ${table} SET ${[sets, ...extraSets].join(', ')} WHERE id = $1 AND deleted_at IS NULL`, [id, ...params]);
}
