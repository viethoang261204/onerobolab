import { createApiClient } from '../api/client';
import { setReconnectProbe, useConnectionStore } from '../api/connection-store';
import type { StudentUser } from './session-store';
import { useStudentSession } from './session-store';

/*
 * The student app's view of the OneRoboLab API: one client (bearer token from
 * the student session) and typed calls. Shapes match apps/api
 * routes/student*.ts. Timestamps are ISO strings.
 */

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export const studentHttp = createApiClient({
  baseUrl,
  getToken: () => useStudentSession.getState().token,
  onUnauthorized: () => useStudentSession.getState().signedOut('Your session ended. Please sign in again.'),
  onConnectivity: (online) => useConnectionStore.getState().setOnline(online),
});

// While offline, the connection store checks the API's health endpoint to notice recovery.
setReconnectProbe(() => studentHttp.get('/health'));

export type ApiLevelState = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'DISABLED';
export type ApiDifficulty = 'BEGINNER' | 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

export interface ApiRequirement {
  readonly type: 'LEVEL_COMPLETED' | 'LEVEL_STARS' | 'WORLD_COMPLETED' | 'TOTAL_STARS' | 'TOTAL_XP' | 'ACHIEVEMENT';
  readonly levelId?: string;
  readonly levelSlug?: string;
  readonly levelTitle?: string;
  readonly worldId?: string;
  readonly worldName?: string;
  readonly achievementId?: string;
  readonly achievementName?: string;
  readonly stars?: number;
  readonly xp?: number;
}

export interface ApiObjective {
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly type: 'START_PROGRAM' | 'REACH_CHECKPOINT' | 'REACH_ALL_CHECKPOINTS' | 'REACH_GOAL' | 'AVOID_COLLISIONS' | 'FINISH_WITHIN' | 'USE_MAX_BLOCKS' | 'CUSTOM';
  readonly config: Record<string, unknown>;
  readonly required: boolean;
  readonly checkpointCode: string | null;
}

export interface ApiHint {
  readonly id: string;
  readonly title: string;
  readonly cost: number;
  readonly revealed: boolean;
  /** null for paid hints not revealed yet. */
  readonly content: string | null;
}

export interface ApiLevelProgress {
  readonly status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  readonly bestStars: number;
  readonly bestScore: number | null;
  readonly bestTimeSeconds: number | null;
  readonly attemptCount: number;
  readonly completedAt: string | null;
  readonly lastAttemptAt: string | null;
}

export interface ApiLevel {
  readonly id: string;
  readonly slug: string;
  readonly worldId: string;
  readonly worldSlug: string;
  readonly title: string;
  readonly briefDescription: string | null;
  readonly description: string | null;
  readonly difficulty: ApiDifficulty;
  readonly sortOrder: number;
  readonly environmentId: string;
  readonly xpReward: number;
  readonly maxStars: number;
  readonly parBlocks: number | null;
  readonly parSeconds: number | null;
  readonly estimatedMinutes: number | null;
  readonly contentVersion: number;
  readonly mapDefinition: Record<string, unknown>;
  readonly sceneConfig: Record<string, unknown>;
  readonly state: ApiLevelState;
  readonly lockReason: string | null;
  readonly unlock: readonly { readonly requirements: readonly ApiRequirement[] }[] | null;
  readonly progress: ApiLevelProgress | null;
  /** Only for levels the student may play. */
  readonly content: {
    readonly allowedBlocks: readonly string[] | null;
    readonly introSteps: readonly string[];
    readonly missionSettings: Record<string, unknown>;
    readonly objectives: readonly ApiObjective[];
    readonly hints: readonly ApiHint[];
  } | null;
}

export interface ApiWorld {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly shortDescription: string | null;
  readonly description: string | null;
  readonly theme: string;
  readonly accentColor: string | null;
  readonly skills: readonly string[];
  readonly difficulty: ApiDifficulty;
  readonly mapPosition: { x?: number; y?: number; z?: number } | null;
  readonly curriculumName: string;
  /** Position on the whole journey (1-based, across curricula). */
  readonly order: number;
}

export interface ApiStats {
  readonly totalXp: number;
  readonly totalStars: number;
  readonly levelsCompleted: number;
  readonly currentStreak: number;
  readonly longestStreak?: number;
}

export interface Catalog {
  readonly student: { readonly id: string; readonly username: string; readonly displayName: string; readonly avatarUrl: string | null };
  readonly stats: ApiStats;
  readonly lastLevelSlug: string | null;
  readonly worlds: readonly ApiWorld[];
  readonly levels: readonly ApiLevel[];
}

export interface ApiProgram {
  readonly id: string;
  readonly blockProgram: unknown;
  readonly pythonCode: string | null;
  readonly version: number;
  readonly updatedAt: string;
}

export interface RunReport {
  readonly objectivesCompleted: readonly string[];
  readonly timeSeconds: number;
  readonly collisions: number;
  readonly errorMessage?: string;
}

export type RunOutcome = 'COMPLETED' | 'FAILED' | 'ERROR' | 'STOPPED';

export interface RunFinish {
  readonly run: { readonly id: string; readonly attemptNumber: number; readonly status: string };
  readonly passed: boolean;
  readonly stars: number;
  readonly maxStars: number;
  readonly score: number;
  readonly xpEarned: number;
  readonly newBest: boolean;
  readonly firstCompletion: boolean;
  readonly blockCount: number;
  readonly criteria: readonly { id: string; label: string; met: boolean }[];
  readonly reasons: readonly string[];
  readonly objectives: readonly { code: string; title: string; required: boolean; type: string; completed: boolean }[];
  readonly achievementsUnlocked: readonly string[];
  readonly unlockedLevels: readonly { id: string; slug: string }[];
  readonly stats: ApiStats | null;
}

const enc = encodeURIComponent;

export const studentApi = {
  login: (username: string, password: string) => studentHttp.post<{ token: string; expiresAt: string; user: StudentUser & { permissions: string[] } }>('/api/auth/login', { username, password }),
  me: () => studentHttp.get<{ user: StudentUser }>('/api/auth/me'),
  logout: () => studentHttp.post<void>('/api/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) => studentHttp.post<void>('/api/auth/change-password', { currentPassword, newPassword }),

  catalog: () => studentHttp.get<Catalog>('/api/catalog'),
  getProgram: (levelSlug: string) => studentHttp.get<{ program: ApiProgram | null }>(`/api/levels/${enc(levelSlug)}/program`),
  saveProgram: (levelSlug: string, body: { blockProgram: unknown; pythonCode: string | null; createVersion?: boolean }) =>
    studentHttp.put<{ program: ApiProgram }>(`/api/levels/${enc(levelSlug)}/program`, body),
  startRun: (levelSlug: string, setup: { layout: number; seed: number }) =>
    studentHttp.post<{ run: { id: string; attemptNumber: number; startedAt: string; blockCount: number } }>(`/api/levels/${enc(levelSlug)}/runs`, setup),
  finishRun: (runId: string, outcome: RunOutcome, result: RunReport) => studentHttp.post<RunFinish>(`/api/runs/${enc(runId)}/finish`, { outcome, result }),
  revealHint: (levelSlug: string, hintId: string) =>
    studentHttp.post<{ hint: { id: string; title: string; content: string; cost: number } }>(`/api/levels/${enc(levelSlug)}/hints/${enc(hintId)}/reveal`, {}),
};
