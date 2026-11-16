import type { SessionUser } from '../session/access';
import type { Query } from './client';
import { api } from './instance';
import type {
  Achievement,
  AttemptDetail,
  Attempt,
  AuditLog,
  Checkpoint,
  ContentStatus,
  Curriculum,
  Dashboard,
  Environment,
  GraphLevel,
  Hint,
  Lesson,
  LevelDetail,
  LevelOverride,
  LevelSummary,
  Objective,
  Paged,
  ProgramDetail,
  ProgramSummary,
  Statistics,
  StatusChange,
  Student,
  StudentProgress,
  World,
} from './types';

/*
 * Typed wrappers for every admin endpoint the console uses (one place to
 * see the whole surface). Bodies are plain objects; the API validates them.
 */

const id = encodeURIComponent;

/** Content with a publishing workflow → its API collection. */
export type WorkflowKind = 'curriculums' | 'worlds' | 'levels' | 'lessons' | 'achievements';

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; expiresAt: string; user: SessionUser }>('/api/auth/login', { username, password }),
  me: () => api.get<{ user: SessionUser }>('/api/auth/me'),
  logout: () => api.post<void>('/api/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) => api.post<void>('/api/auth/change-password', { currentPassword, newPassword }),
};

export const healthApi = {
  check: () => api.get<{ status: string; database: string }>('/health'),
};

export const studentsApi = {
  list: (q: Query) => api.get<{ students: Student[] } & Paged>('/api/admin/students', q),
  get: (studentId: string) => api.get<{ student: Student }>(`/api/admin/students/${id(studentId)}`),
  create: (body: { username: string; displayName: string; password: string; classLabel?: string | null; mustChangePassword?: boolean }) =>
    api.post<{ student: Student }>('/api/admin/students', body),
  update: (studentId: string, body: Record<string, unknown>) => api.patch<{ student: Student }>(`/api/admin/students/${id(studentId)}`, body),
  resetPassword: (studentId: string, newPassword: string, mustChangePassword: boolean) =>
    api.post<void>(`/api/admin/students/${id(studentId)}/reset-password`, { newPassword, mustChangePassword }),
  progress: (studentId: string) => api.get<StudentProgress>(`/api/admin/students/${id(studentId)}/progress`),
  unlock: (studentId: string, levelId: string, body: { reason?: string; expiresAt?: string }) =>
    api.post(`/api/admin/students/${id(studentId)}/levels/${id(levelId)}/unlock`, body),
  lock: (studentId: string, levelId: string, body: { reason?: string }) => api.post(`/api/admin/students/${id(studentId)}/levels/${id(levelId)}/lock`, body),
  clearAccess: (studentId: string, levelId: string) => api.del(`/api/admin/students/${id(studentId)}/levels/${id(levelId)}/access`),
};

export const activityApi = {
  dashboard: () => api.get<Dashboard>('/api/admin/dashboard'),
  statistics: (days: number) => api.get<Statistics>('/api/admin/statistics', { days }),
  attempts: (q: Query) => api.get<{ attempts: Attempt[] } & Paged>('/api/admin/attempts', q),
  attempt: (attemptId: string) => api.get<AttemptDetail>(`/api/admin/attempts/${id(attemptId)}`),
  programs: (q: Query) => api.get<{ programs: ProgramSummary[] } & Paged>('/api/admin/programs', q),
  program: (programId: string) => api.get<ProgramDetail>(`/api/admin/programs/${id(programId)}`),
  auditLogs: (q: Query) => api.get<{ logs: AuditLog[] } & Paged>('/api/admin/audit-logs', q),
};

export const contentApi = {
  environments: () => api.get<{ environments: Environment[] }>('/api/admin/environments'),

  curriculums: () => api.get<{ curriculums: Curriculum[] }>('/api/admin/curriculums'),
  createCurriculum: (body: Record<string, unknown>) => api.post<{ curriculum: Curriculum }>('/api/admin/curriculums', body),
  updateCurriculum: (cid: string, body: Record<string, unknown>) => api.patch<{ curriculum: Curriculum }>(`/api/admin/curriculums/${id(cid)}`, body),
  orderCurriculums: (ids: string[]) => api.put<void>('/api/admin/curriculums/order', { ids }),

  worlds: (curriculumId?: string) => api.get<{ worlds: World[] }>('/api/admin/worlds', { curriculumId }),
  createWorld: (body: Record<string, unknown>) => api.post<{ world: World }>('/api/admin/worlds', body),
  updateWorld: (wid: string, body: Record<string, unknown>) => api.patch<{ world: World }>(`/api/admin/worlds/${id(wid)}`, body),
  orderWorlds: (curriculumId: string, ids: string[]) => api.put<void>('/api/admin/worlds/order', { curriculumId, ids }),

  levels: (q: Query) => api.get<{ levels: LevelSummary[] } & Paged>('/api/admin/levels', q),
  levelGraph: () => api.get<{ levels: GraphLevel[] }>('/api/admin/levels/graph'),
  level: (lid: string) => api.get<{ level: LevelDetail }>(`/api/admin/levels/${id(lid)}`),
  createLevel: (body: Record<string, unknown>) => api.post<{ level: LevelDetail }>('/api/admin/levels', body),
  updateLevel: (lid: string, body: Record<string, unknown>) => api.patch<{ level: LevelDetail }>(`/api/admin/levels/${id(lid)}`, body),
  deleteLevel: (lid: string) => api.del(`/api/admin/levels/${id(lid)}`),
  orderLevels: (worldId: string, ids: string[]) => api.put<void>('/api/admin/levels/order', { worldId, ids }),
  levelAccess: (lid: string) => api.get<{ overrides: LevelOverride[] }>(`/api/admin/levels/${id(lid)}/access`),
  setPrerequisites: (lid: string, groups: { requirements: Record<string, unknown>[] }[]) =>
    api.put<{ groups: unknown[] }>(`/api/admin/levels/${id(lid)}/prerequisites`, { groups }),

  createCheckpoint: (lid: string, body: Record<string, unknown>) => api.post<{ checkpoint: Checkpoint }>(`/api/admin/levels/${id(lid)}/checkpoints`, body),
  updateCheckpoint: (cid: string, body: Record<string, unknown>) => api.patch<{ checkpoint: Checkpoint }>(`/api/admin/checkpoints/${id(cid)}`, body),
  deleteCheckpoint: (cid: string) => api.del(`/api/admin/checkpoints/${id(cid)}`),

  createObjective: (lid: string, body: Record<string, unknown>) => api.post<{ objective: Objective }>(`/api/admin/levels/${id(lid)}/objectives`, body),
  updateObjective: (oid: string, body: Record<string, unknown>) => api.patch<{ objective: Objective }>(`/api/admin/objectives/${id(oid)}`, body),
  deleteObjective: (oid: string) => api.del(`/api/admin/objectives/${id(oid)}`),
  orderObjectives: (lid: string, ids: string[]) => api.put<void>(`/api/admin/levels/${id(lid)}/objectives/order`, { ids }),

  createHint: (lid: string, body: Record<string, unknown>) => api.post<{ hint: Hint }>(`/api/admin/levels/${id(lid)}/hints`, body),
  updateHint: (hid: string, body: Record<string, unknown>) => api.patch<{ hint: Hint }>(`/api/admin/hints/${id(hid)}`, body),
  deleteHint: (hid: string) => api.del(`/api/admin/hints/${id(hid)}`),
  orderHints: (lid: string, ids: string[]) => api.put<void>(`/api/admin/levels/${id(lid)}/hints/order`, { ids }),

  lessons: (q: Query = {}) => api.get<{ lessons: Lesson[] }>('/api/admin/lessons', q),
  createLesson: (body: Record<string, unknown>) => api.post<{ lesson: Lesson }>('/api/admin/lessons', body),
  updateLesson: (lid: string, body: Record<string, unknown>) => api.patch<{ lesson: Lesson }>(`/api/admin/lessons/${id(lid)}`, body),
  deleteLesson: (lid: string) => api.del(`/api/admin/lessons/${id(lid)}`),

  achievements: () => api.get<{ achievements: Achievement[] }>('/api/admin/achievements'),
  createAchievement: (body: Record<string, unknown>) => api.post<{ achievement: Achievement }>('/api/admin/achievements', body),
  updateAchievement: (aid: string, body: Record<string, unknown>) => api.patch<{ achievement: Achievement }>(`/api/admin/achievements/${id(aid)}`, body),
  deleteAchievement: (aid: string) => api.del(`/api/admin/achievements/${id(aid)}`),

  /** Publishing workflow: DRAFT → REVIEW → PUBLISHED → ARCHIVED. */
  setStatus: (kind: WorkflowKind, itemId: string, status: ContentStatus, note?: string) =>
    api.post<StatusChange>(`/api/admin/${kind}/${id(itemId)}/status`, note ? { status, note } : { status }),
};
