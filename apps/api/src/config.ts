import { z } from 'zod';

/**
 * Runtime configuration, read once from the environment (never hard-coded).
 * Render / .env provide: DATABASE_URL, AUTH_SECRET, CORS_ORIGIN, PORT, …
 */
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).optional(),
  /** HMAC key for session-token hashes. ≥ 32 characters of randomness. */
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  /** Comma-separated list of allowed browser origins (e.g. https://onerobolab.example.com). */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24 * 7),
  /** Pool size per instance (Neon pooled endpoints handle many clients). */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Login attempts per client IP per window (accounts also lock after 5 wrong passwords). */
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).default(10),
  LOGIN_RATE_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
});

export type Config = z.infer<typeof Env> & { readonly corsOrigins: readonly string[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration — ${problems}`);
  }
  const corsOrigins = parsed.data.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return { ...parsed.data, corsOrigins };
}
