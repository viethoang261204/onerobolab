import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

/**
 * Every error response has one shape:
 *   { "error": { "code": "LEVEL_LOCKED", "message": "…", "details"?: … } }
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Sign in to continue.') => new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have access to this resource.', code = 'FORBIDDEN') => new AppError(403, code, message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);
export const unprocessable = (code: string, message: string, details?: unknown) => new AppError(422, code, message, details);

/** PostgreSQL error codes we translate into client errors. */
const PG: Record<string, { status: number; code: string; message: string }> = {
  '23505': { status: 409, code: 'CONFLICT', message: 'That value is already in use.' },
  '23503': { status: 422, code: 'INVALID_REFERENCE', message: 'A referenced record does not exist.' },
  '23001': { status: 409, code: 'IN_USE', message: 'This record is still referenced by other data.' },
  '23514': { status: 422, code: 'CONSTRAINT_VIOLATION', message: 'The data breaks a validation rule.' },
  '23502': { status: 422, code: 'CONSTRAINT_VIOLATION', message: 'A required value is missing.' },
  '22P02': { status: 400, code: 'BAD_REQUEST', message: 'A value has the wrong format.' },
  '22001': { status: 422, code: 'CONSTRAINT_VIOLATION', message: 'A value is too long.' },
};

interface PgLike {
  code?: string;
  constraint?: string;
}

export function errorHandler(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  const send = (status: number, code: string, message: string, details?: unknown) =>
    reply.status(status).send({ error: { code, message, ...(details !== undefined && { details }) } });

  if (err instanceof AppError) return send(err.status, err.code, err.message, err.details);
  if (err instanceof ZodError) {
    return send(400, 'VALIDATION_FAILED', 'The request is not valid.', err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  const fe = err as FastifyError;
  if (fe.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return send(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  if (fe.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') return send(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send JSON (Content-Type: application/json).');
  if (fe.code === 'FST_ERR_CTP_EMPTY_JSON_BODY' || (fe.statusCode === 400 && fe.message?.includes('JSON'))) return send(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  if (fe.statusCode === 429) return send(429, 'RATE_LIMITED', 'Too many requests — please wait and try again.');
  const pgCode = (err as PgLike).code;
  if (pgCode && PG[pgCode]) {
    const m = PG[pgCode]!;
    return send(m.status, m.code, m.message, (err as PgLike).constraint ? { constraint: (err as PgLike).constraint } : undefined);
  }
  if (fe.statusCode && fe.statusCode >= 400 && fe.statusCode < 500) return send(fe.statusCode, 'BAD_REQUEST', fe.message);
  req.log.error({ err }, 'unhandled error');
  return send(500, 'INTERNAL_ERROR', 'Something went wrong on our side.');
}
