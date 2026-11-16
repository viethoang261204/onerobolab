import type { AccessMode, AttemptStatus, AuditLog, ContentStatus, Difficulty, LevelState, ObjectiveType, UserStatus } from '../api/types';

/*
 * Labels and colour tones for statuses, plus human descriptions of audit
 * entries. Pure data (tested); components map `Tone` to design tokens.
 */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'review';

export const CONTENT_STATUS: Record<ContentStatus, { label: string; tone: Tone; help: string }> = {
  DRAFT: { label: 'Draft', tone: 'neutral', help: 'Being written. Students cannot see it.' },
  REVIEW: { label: 'In review', tone: 'review', help: 'Waiting for a reviewer. Students cannot see it.' },
  PUBLISHED: { label: 'Published', tone: 'success', help: 'Live for students.' },
  ARCHIVED: { label: 'Archived', tone: 'warning', help: 'Retired. Hidden from students, kept for history.' },
};

export interface WorkflowAction {
  readonly to: ContentStatus;
  readonly label: string;
  readonly tone: 'primary' | 'secondary' | 'danger';
  /** Needs the publishing permission (changes what students see). */
  readonly live: boolean;
  readonly confirm: string | null;
}

/** The moves offered from each status — mirrors the API's workflow (apps/api/src/domain/workflow.ts). */
export function workflowActions(status: ContentStatus): WorkflowAction[] {
  switch (status) {
    case 'DRAFT':
      return [
        { to: 'REVIEW', label: 'Send for review', tone: 'primary', live: false, confirm: null },
        { to: 'ARCHIVED', label: 'Archive', tone: 'secondary', live: false, confirm: 'Archive this item? It stays hidden from students until restored.' },
      ];
    case 'REVIEW':
      return [
        { to: 'PUBLISHED', label: 'Approve & publish', tone: 'primary', live: true, confirm: 'Publish now? Students will see it immediately.' },
        { to: 'DRAFT', label: 'Request changes', tone: 'secondary', live: false, confirm: null },
        { to: 'ARCHIVED', label: 'Archive', tone: 'secondary', live: false, confirm: 'Archive this item?' },
      ];
    case 'PUBLISHED':
      return [
        { to: 'DRAFT', label: 'Unpublish', tone: 'secondary', live: true, confirm: 'Unpublish? Students lose access immediately; their progress is kept.' },
        { to: 'ARCHIVED', label: 'Archive', tone: 'danger', live: true, confirm: 'Archive a live item? Students lose access immediately; their progress is kept.' },
      ];
    case 'ARCHIVED':
      return [{ to: 'DRAFT', label: 'Restore to draft', tone: 'secondary', live: false, confirm: null }];
  }
}

export const USER_STATUS: Record<UserStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  DISABLED: { label: 'Disabled', tone: 'danger' },
  PENDING: { label: 'Pending', tone: 'warning' },
};

export const ATTEMPT_STATUS: Record<AttemptStatus, { label: string; tone: Tone }> = {
  RUNNING: { label: 'Running', tone: 'info' },
  PASSED: { label: 'Passed', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  ERROR: { label: 'Error', tone: 'warning' },
  ABORTED: { label: 'Stopped', tone: 'neutral' },
};

export const LEVEL_STATE: Record<LevelState, { label: string; tone: Tone }> = {
  LOCKED: { label: 'Locked', tone: 'neutral' },
  AVAILABLE: { label: 'Available', tone: 'info' },
  IN_PROGRESS: { label: 'In progress', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  DISABLED: { label: 'Disabled', tone: 'danger' },
};

/** Reasons from get_student_level_states (database/schema.sql). */
export const STATE_REASONS: Record<string, string> = {
  PREREQUISITES_NOT_MET: 'Prerequisites not met',
  PREREQUISITES_MET: 'Prerequisites met',
  NO_PREREQUISITES: 'No prerequisites',
  LOCKED_BY_ADMIN: 'Locked for everyone',
  OPEN_FOR_ALL: 'Unlocked for everyone',
  ADMIN_OVERRIDE: 'Manual override',
  COMPLETED: 'Completed',
};

export const DIFFICULTY: Record<Difficulty, string> = {
  BEGINNER: 'Beginner',
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
  EXPERT: 'Expert',
};
export const DIFFICULTIES = Object.keys(DIFFICULTY) as Difficulty[];

export const ACCESS_MODE: Record<AccessMode, { label: string; help: string }> = {
  AUTO: { label: 'After prerequisites', help: 'Unlocks when the student meets any of the rule groups below (or immediately if there are none).' },
  UNLOCKED: { label: 'Unlocked for everyone', help: 'Every student can play it, whatever they have completed.' },
  LOCKED: { label: 'Locked for everyone', help: 'Nobody can play it, except students you unlock manually.' },
};

export const OBJECTIVE_TYPES: Record<ObjectiveType, { label: string; help: string }> = {
  START_PROGRAM: { label: 'Start the program', help: 'Completed by any recorded run.' },
  REACH_CHECKPOINT: { label: 'Reach a checkpoint', help: 'The robot drives through one checkpoint on the map.' },
  REACH_ALL_CHECKPOINTS: { label: 'Reach all checkpoints', help: 'Every required checkpoint, in any order.' },
  REACH_GOAL: { label: 'Reach the goal', help: 'The robot parks in the finish zone. Every published level needs one.' },
  AVOID_COLLISIONS: { label: 'Avoid collisions', help: 'Judged by the server from the reported collisions (config: maxCollisions).' },
  FINISH_WITHIN: { label: 'Finish within a time', help: 'Config: seconds.' },
  USE_MAX_BLOCKS: { label: 'Use at most N blocks', help: 'Checked by the server with its own block count. Config: count.' },
  CUSTOM: { label: 'Custom', help: 'A goal shown to students (e.g. "cross the bridge"). The server can’t verify it, so it never blocks passing.' },
};

/** "REORDER_HINTS" → "Reorder hints". */
export const humanize = (code: string) => code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ');

const ACTIONS: Record<string, string> = {
  CREATE_STUDENT: 'Created student',
  UPDATE_STUDENT: 'Updated student',
  DISABLE_STUDENT: 'Disabled student',
  ENABLE_STUDENT: 'Enabled student',
  RESET_PASSWORD: 'Reset password',
  UNLOCK_LEVEL: 'Unlocked level',
  LOCK_LEVEL: 'Locked level',
  CLEAR_LEVEL_ACCESS: 'Removed level override',
  SET_PREREQUISITES: 'Changed unlock rules',
  LEVEL_COMPLETED: 'Completed level',
};
const VERBS: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  REVIEW: 'Sent for review',
  REJECT: 'Requested changes on',
  PUBLISH: 'Published',
  UNPUBLISH: 'Unpublished',
  ARCHIVE: 'Archived',
  RESTORE: 'Restored',
  REORDER: 'Reordered',
};

/** "PUBLISH_LEVEL" → "Published level", "REORDER_HINTS" → "Reordered hints". */
export function actionLabel(action: string): string {
  const known = ACTIONS[action];
  if (known) return known;
  const [verb, ...rest] = action.split('_');
  const v = verb ? VERBS[verb] : undefined;
  return v && rest.length ? `${v} ${rest.join(' ').toLowerCase()}` : humanize(action);
}

export function actionTone(action: string): Tone {
  if (/^(DELETE|DISABLE|LOCK|ARCHIVE|UNPUBLISH)/.test(action)) return 'danger';
  if (/^(PUBLISH|ENABLE|UNLOCK|CREATE)/.test(action) || action === 'LEVEL_COMPLETED') return 'success';
  if (/^(REVIEW|REJECT)/.test(action)) return 'review';
  if (action === 'RESET_PASSWORD') return 'warning';
  return 'info';
}

const ENTITY_LABEL: Record<string, string> = {
  user: 'Student',
  student_level_access: 'Level access',
  level: 'Level',
  world: 'World',
  curriculum: 'Curriculum',
  lesson: 'Lesson',
  achievement: 'Achievement',
  level_objective: 'Objective',
  level_hint: 'Hint',
  level_checkpoint: 'Checkpoint',
};
export const entityLabel = (type: string) => ENTITY_LABEL[type] ?? humanize(type.toUpperCase());

/**
 * Readable subject lines for an audit entry, e.g.
 *   ["Student: Nguyễn Văn A", "Level: Bridge Crossing", "Reason: extra practice"]
 */
export function auditDetails(log: Pick<AuditLog, 'entityType' | 'studentName' | 'levelTitle' | 'entityName' | 'newData' | 'oldData'>): string[] {
  const out: string[] = [];
  if (log.studentName) out.push(`Student: ${log.studentName}`);
  if (log.levelTitle) out.push(`Level: ${log.levelTitle}`);
  if (log.entityName) out.push(`${entityLabel(log.entityType)}: ${log.entityName}`);
  const next = (log.newData ?? {}) as Record<string, unknown>;
  const prev = (log.oldData ?? {}) as Record<string, unknown>;
  if (typeof next.reason === 'string' && next.reason) out.push(`Reason: ${next.reason}`);
  if (typeof next.note === 'string' && next.note) out.push(`Note: ${next.note}`);
  if (typeof prev.status === 'string' && typeof next.status === 'string' && prev.status !== next.status) {
    out.push(`Status: ${statusWord(prev.status)} → ${statusWord(next.status)}`);
  }
  if (typeof next.expiresAt === 'string') out.push(`Until: ${next.expiresAt.slice(0, 10)}`);
  return out;
}

const statusWord = (s: string) => (s in CONTENT_STATUS ? CONTENT_STATUS[s as ContentStatus].label : humanize(s));
