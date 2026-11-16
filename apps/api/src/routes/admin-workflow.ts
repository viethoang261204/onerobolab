import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.ts';
import type { Queryable } from '../db/db.ts';
import { publishProblems } from '../domain/level-readiness.ts';
import { CONTENT_STATUSES, nextStatuses, touchesLiveContent, transitionVerb, type ContentStatus } from '../domain/workflow.ts';
import { audit, type AuditAction, type WorkflowEntity } from '../http/audit.ts';
import { AppError, forbidden, notFound, unprocessable } from '../http/errors.ts';
import { UuidParam } from '../http/sql.ts';

/*
 * Publishing workflow (DRAFT → REVIEW → PUBLISHED → ARCHIVED) and ordering
 * for curriculum content. Status is never set through PATCH or create — only
 * here, where each move is validated, permission-checked and audited.
 */

interface WorkflowKind {
  readonly table: 'curricula' | 'worlds' | 'levels' | 'lessons' | 'achievements';
  readonly entity: WorkflowEntity;
  readonly auditType: string;
  /** Needed for any move. */
  readonly manage: string;
  /** Needed for moves into or out of PUBLISHED (what students see). */
  readonly publish: string;
}

const KINDS: Readonly<Record<string, WorkflowKind>> = {
  curriculums: { table: 'curricula', entity: 'CURRICULUM', auditType: 'curriculum', manage: 'curriculum.manage', publish: 'levels.publish' },
  worlds: { table: 'worlds', entity: 'WORLD', auditType: 'world', manage: 'curriculum.manage', publish: 'levels.publish' },
  levels: { table: 'levels', entity: 'LEVEL', auditType: 'level', manage: 'curriculum.manage', publish: 'levels.publish' },
  lessons: { table: 'lessons', entity: 'LESSON', auditType: 'lesson', manage: 'content.manage', publish: 'content.manage' },
  achievements: { table: 'achievements', entity: 'ACHIEVEMENT', auditType: 'achievement', manage: 'achievements.manage', publish: 'achievements.manage' },
};

const StatusBody = z.object({ status: z.enum(CONTENT_STATUSES), note: z.string().trim().max(500).optional() }).strict();

/** Can students see this level right now (level, world and curriculum all live)? */
async function levelVisibleToStudents(q: Queryable, levelId: string): Promise<boolean> {
  const { rows } = await q.query<{ visible: boolean }>(
    `SELECT (l.status = 'PUBLISHED' AND l.visibility = 'VISIBLE' AND w.status = 'PUBLISHED' AND w.is_visible AND c.status = 'PUBLISHED') AS visible
       FROM levels l JOIN worlds w ON w.id = l.world_id JOIN curricula c ON c.id = w.curriculum_id WHERE l.id = $1`,
    [levelId],
  );
  return rows[0]?.visible ?? false;
}

/** Ordering: `parent` scopes the list (null = top level), `ids` is the complete new order. */
interface OrderSpec {
  readonly table: 'curricula' | 'worlds' | 'levels' | 'level_objectives' | 'level_hints';
  readonly parentColumn: string | null;
  readonly action: AuditAction;
  readonly auditType: string;
}

const ORDER_SPECS = {
  curricula: { table: 'curricula', parentColumn: null, action: 'REORDER_CURRICULA', auditType: 'curriculum' },
  worlds: { table: 'worlds', parentColumn: 'curriculum_id', action: 'REORDER_WORLDS', auditType: 'curriculum' },
  levels: { table: 'levels', parentColumn: 'world_id', action: 'REORDER_LEVELS', auditType: 'world' },
  objectives: { table: 'level_objectives', parentColumn: 'level_id', action: 'REORDER_OBJECTIVES', auditType: 'level' },
  hints: { table: 'level_hints', parentColumn: 'level_id', action: 'REORDER_HINTS', auditType: 'level' },
} as const satisfies Record<string, OrderSpec>;

const Ids = z.array(z.uuid()).min(1).max(500).refine((ids) => new Set(ids).size === ids.length, 'Duplicate ids.');

/**
 * Rewrites sort_order = 1…n for exactly the given children. The list must be
 * the parent's complete, current set (no silent partial reorders).
 */
async function applyOrder(q: Queryable, spec: OrderSpec, parentId: string | null, ids: string[]): Promise<void> {
  const scope = spec.parentColumn ? `${spec.parentColumn} = $1 AND` : '';
  const params = spec.parentColumn ? [parentId] : [];
  const { rows } = await q.query<{ id: string }>(`SELECT id FROM ${spec.table} WHERE ${scope} deleted_at IS NULL FOR UPDATE`, params);
  const current = new Set(rows.map((r) => r.id));
  if (current.size !== ids.length || !ids.every((id) => current.has(id))) {
    throw unprocessable('ORDER_MISMATCH', 'The list must contain every item exactly once — reload and try again.');
  }
  // Two passes: positions are unique for hints, so move everything out of the way first.
  await q.query(`UPDATE ${spec.table} SET sort_order = sort_order + 100000 WHERE id = ANY($1::uuid[])`, [ids]);
  await q.query(
    `UPDATE ${spec.table} t SET sort_order = o.pos FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, pos) WHERE t.id = o.id`,
    [ids],
  );
}

export function registerAdminWorkflowRoutes(app: FastifyInstance, { db, permissions }: AppDeps) {
  /** Moves one item to `target`; shared by /status and the /publish · /unpublish shortcuts. */
  async function changeStatus(req: FastifyRequest, kind: WorkflowKind, id: string, target: ContentStatus, note?: string) {
    return db.tx(async (q) => {
      const { rows } = await q.query<{ status: ContentStatus }>(`SELECT status FROM ${kind.table} WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [id]);
      const from = rows[0]?.status;
      if (!from) throw notFound(kind.auditType.charAt(0).toUpperCase() + kind.auditType.slice(1));
      if (from === target) throw new AppError(409, 'ALREADY_IN_STATUS', `It is already ${target.toLowerCase()}.`);
      const verb = transitionVerb(from, target);
      if (!verb) {
        throw new AppError(409, 'INVALID_TRANSITION', `Cannot move from ${from} to ${target}.`, { from, to: target, allowed: nextStatuses(from) });
      }
      if (touchesLiveContent(from, target) && !(await permissions.has(req, kind.publish))) throw forbidden('Only reviewers with publishing rights can change live content.');
      if (kind.table === 'levels' && target === 'PUBLISHED') {
        const problems = await publishProblems(q, id);
        if (problems.length) throw unprocessable('LEVEL_NOT_READY', 'The level is not ready to publish.', problems);
      }
      await q.query(`UPDATE ${kind.table} SET status = $2::content_status WHERE id = $1`, [id, target]);
      await audit(q, req, {
        action: `${verb}_${kind.entity}`,
        entityType: kind.auditType,
        entityId: id,
        oldData: { status: from },
        newData: { status: target, ...(note && { note }) },
      });
      const result: { id: string; status: ContentStatus; previousStatus: ContentStatus; allowedNext: ContentStatus[]; visibleToStudents?: boolean } = {
        id,
        status: target,
        previousStatus: from,
        allowedNext: nextStatuses(target),
      };
      if (kind.table === 'levels') result.visibleToStudents = await levelVisibleToStudents(q, id);
      return result;
    });
  }

  for (const [path, kind] of Object.entries(KINDS)) {
    app.post(`/api/admin/${path}/:id/status`, { preHandler: permissions.require(kind.manage) }, async (req) => {
      const { id } = UuidParam.parse(req.params);
      const body = StatusBody.parse(req.body);
      return changeStatus(req, kind, id, body.status, body.note);
    });
  }

  // Phase 2 shortcuts. Publishing still requires the level to be in REVIEW.
  const levels = KINDS.levels!;
  app.post('/api/admin/levels/:id/publish', { preHandler: permissions.require('levels.publish') }, async (req) => {
    const { id } = UuidParam.parse(req.params);
    return changeStatus(req, levels, id, 'PUBLISHED');
  });
  app.post('/api/admin/levels/:id/unpublish', { preHandler: permissions.require('levels.publish') }, async (req) => {
    const { id } = UuidParam.parse(req.params);
    return changeStatus(req, levels, id, 'DRAFT');
  });

  // ── ordering ───────────────────────────────────────────────────────────
  const reorder = (spec: OrderSpec, parentFrom: (req: FastifyRequest, body: Record<string, unknown>) => string | null) =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = z.object({ ids: Ids, curriculumId: z.uuid().optional(), worldId: z.uuid().optional() }).strict().parse(req.body);
      const parentId = parentFrom(req, body);
      if (spec.parentColumn && !parentId) throw unprocessable('PARENT_REQUIRED', 'Say which list is being reordered.');
      await db.tx(async (q) => {
        await applyOrder(q, spec, parentId, body.ids);
        await audit(q, req, { action: spec.action, entityType: spec.auditType, entityId: parentId ?? 'all', newData: { order: body.ids } });
      });
      return reply.status(204).send();
    };
  const manage = { preHandler: permissions.require('curriculum.manage') };
  app.put('/api/admin/curriculums/order', manage, reorder(ORDER_SPECS.curricula, () => null));
  app.put('/api/admin/worlds/order', manage, reorder(ORDER_SPECS.worlds, (_r, b) => (b.curriculumId as string | undefined) ?? null));
  app.put('/api/admin/levels/order', manage, reorder(ORDER_SPECS.levels, (_r, b) => (b.worldId as string | undefined) ?? null));
  app.put('/api/admin/levels/:id/objectives/order', manage, reorder(ORDER_SPECS.objectives, (r) => UuidParam.parse(r.params).id));
  app.put('/api/admin/levels/:id/hints/order', manage, reorder(ORDER_SPECS.hints, (r) => UuidParam.parse(r.params).id));
}
