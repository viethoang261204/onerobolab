import type { FastifyRequest } from 'fastify';
import type { Queryable } from '../db/db.ts';
import type { WorkflowVerb } from '../domain/workflow.ts';

/** Content types that follow the publishing workflow. */
export type WorkflowEntity = 'CURRICULUM' | 'WORLD' | 'LEVEL' | 'LESSON' | 'ACHIEVEMENT';

export type AuditAction =
  | 'CREATE_STUDENT'
  | 'UPDATE_STUDENT'
  | 'DISABLE_STUDENT'
  | 'ENABLE_STUDENT'
  | 'RESET_PASSWORD'
  | 'CREATE_CURRICULUM'
  | 'UPDATE_CURRICULUM'
  | 'CREATE_WORLD'
  | 'UPDATE_WORLD'
  | 'CREATE_LEVEL'
  | 'UPDATE_LEVEL'
  | 'DELETE_LEVEL'
  | 'PUBLISH_LEVEL'
  | 'UNPUBLISH_LEVEL'
  | 'UNLOCK_LEVEL'
  | 'LOCK_LEVEL'
  | 'CLEAR_LEVEL_ACCESS'
  | 'CREATE_OBJECTIVE'
  | 'UPDATE_OBJECTIVE'
  | 'DELETE_OBJECTIVE'
  | 'CREATE_CHECKPOINT'
  | 'UPDATE_CHECKPOINT'
  | 'DELETE_CHECKPOINT'
  | 'CREATE_HINT'
  | 'UPDATE_HINT'
  | 'DELETE_HINT'
  | 'SET_PREREQUISITES'
  | 'CREATE_LESSON'
  | 'UPDATE_LESSON'
  | 'DELETE_LESSON'
  | 'CREATE_ACHIEVEMENT'
  | 'UPDATE_ACHIEVEMENT'
  | 'DELETE_ACHIEVEMENT'
  /** Workflow moves: REVIEW_LEVEL, PUBLISH_WORLD, ARCHIVE_LESSON, … */
  | `${WorkflowVerb}_${WorkflowEntity}`
  | 'REORDER_CURRICULA'
  | 'REORDER_WORLDS'
  | 'REORDER_LEVELS'
  | 'REORDER_OBJECTIVES'
  | 'REORDER_HINTS';

/**
 * Append an audit row in the same transaction as the change (so a change is
 * never saved without its audit entry, or vice versa).
 */
export async function audit(
  q: Queryable,
  req: FastifyRequest,
  entry: { action: AuditAction; entityType: string; entityId: string; oldData?: unknown; newData?: unknown },
): Promise<void> {
  await q.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent, request_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::inet, $8, $9)`,
    [
      req.user?.id ?? null,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.oldData === undefined ? null : JSON.stringify(entry.oldData),
      entry.newData === undefined ? null : JSON.stringify(entry.newData),
      req.ip || null,
      req.headers['user-agent']?.slice(0, 512) ?? null,
      req.id,
    ],
  );
}
