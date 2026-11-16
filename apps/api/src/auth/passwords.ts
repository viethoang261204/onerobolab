import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';

/** Seed placeholder from database/seed.sql — never verifies. */
export const PLACEHOLDER_HASH = 'REPLACE_WITH_ARGON2_HASH';

/**
 * Argon2id with the OWASP-recommended baseline (19 MiB, 2 passes, 1 lane).
 * @node-rs/argon2 uses Argon2id by default.
 */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .refine((p) => p.trim().length === p.length, 'Password cannot start or end with spaces.');

export const hashPassword = (password: string) => hash(password, OPTIONS);

let dummy: Promise<string> | null = null;
/** A real hash to verify against when the user doesn't exist (equalises timing). */
const dummyHash = () => (dummy ??= hash('timing-equaliser-not-a-password', OPTIONS));

/**
 * Constant-effort verification: unknown users and placeholder hashes still
 * cost one Argon2 verification, so response time doesn't reveal accounts.
 */
export async function verifyPassword(storedHash: string | null, password: string): Promise<boolean> {
  if (!storedHash || storedHash === PLACEHOLDER_HASH || !storedHash.startsWith('$argon2')) {
    await verify(await dummyHash(), password).catch(() => false);
    return false;
  }
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
