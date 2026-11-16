import { z } from 'zod';
import { badRequest } from './errors.ts';

/** Column mapping for PATCH endpoints: API field → SQL column (identifiers come only from code). */
export interface ColumnSpec {
  readonly col: string;
  readonly cast?: string;
  readonly json?: boolean;
}

/**
 * Builds `SET a = $1, b = $2::jsonb …` for the provided fields only.
 * Values are always bound parameters.
 */
export function buildUpdate(specs: Readonly<Record<string, ColumnSpec>>, patch: Record<string, unknown>, firstParam = 1): { sets: string; params: unknown[] } {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, spec] of Object.entries(specs)) {
    if (!(key in patch) || patch[key] === undefined) continue;
    const value = patch[key];
    params.push(spec.json && value !== null ? JSON.stringify(value) : value);
    sets.push(`${spec.col} = $${firstParam + params.length - 1}${spec.cast ? `::${spec.cast}` : ''}`);
  }
  if (!sets.length) throw badRequest('Nothing to update.');
  return { sets: sets.join(', '), params };
}

export const UuidParam = z.object({ id: z.uuid() });
export const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lower-case letters, digits and dashes.').max(80);

export const Pagination = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** Escape %, _ and \ for LIKE patterns. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Bounded JSON object (map definitions, configs). */
export const jsonObject = (maxBytes: number) =>
  z
    .record(z.string(), z.unknown())
    .refine((v) => Buffer.byteLength(JSON.stringify(v), 'utf8') <= maxBytes, `JSON is larger than ${maxBytes} bytes.`)
    .refine((v) => !JSON.stringify(v).includes('"__proto__"'), 'Reserved key.');
