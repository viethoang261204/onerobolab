/*
 * Shapes returned by the admin API (apps/api). Timestamps are ISO strings.
 */

export type ContentStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type Difficulty = 'BEGINNER' | 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
export type AccessMode = 'AUTO' | 'UNLOCKED' | 'LOCKED';
export type LevelState = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'DISABLED';
export type AttemptStatus = 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'ABORTED';
export type UserStatus = 'ACTIVE' | 'DISABLED' | 'PENDING';
export type ObjectiveType = 'START_PROGRAM' | 'REACH_CHECKPOINT' | 'REACH_ALL_CHECKPOINTS' | 'REACH_GOAL' | 'AVOID_COLLISIONS' | 'FINISH_WITHIN' | 'USE_MAX_BLOCKS' | 'CUSTOM';
export type LessonContentType = 'TEXT' | 'MARKDOWN' | 'VIDEO' | 'IMAGE' | 'INTERACTIVE';

export interface Paged {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

// ── students ────────────────────────────────────────────────────────────
export interface Student {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly status: UserStatus;
  readonly mustChangePassword: boolean;
  readonly lastLoginAt: string | null;
  readonly lastActivityAt: string | null;
  readonly createdAt: string;
  readonly loginLocked: boolean;
  readonly classLabel: string | null;
  readonly notes: string | null;
  readonly totalXp: number;
  readonly totalStars: number;
  readonly levelsCompleted: number;
  readonly currentStreak: number;
}

export interface StudentLevelRow {
  readonly levelId: string;
  readonly slug: string;
  readonly title: string;
  readonly publishStatus: ContentStatus;
  readonly worldSlug: string;
  readonly worldName: string;
  readonly state: LevelState | null;
  readonly reason: string | null;
  readonly progressStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | null;
  readonly bestStars: number | null;
  readonly bestScore: number | null;
  readonly bestTimeSeconds: number | null;
  readonly attemptCount: number | null;
  readonly hintsUsed: number | null;
  readonly completedAt: string | null;
  readonly lastAttemptAt: string | null;
}

export interface AccessOverride {
  readonly levelId: string;
  readonly slug: string;
  readonly status: 'LOCKED' | 'AVAILABLE' | 'COMPLETED' | 'DISABLED';
  readonly reason: string | null;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly grantedBy: string | null;
  readonly updatedAt: string;
}

export interface StudentProgress {
  readonly student: Student;
  readonly levels: readonly StudentLevelRow[];
  readonly overrides: readonly AccessOverride[];
  readonly achievements: readonly { slug: string; name: string; unlockedAt: string }[];
}

// ── attempts & programs ─────────────────────────────────────────────────
export interface Attempt {
  readonly id: string;
  readonly studentId: string;
  readonly username: string;
  readonly studentName: string;
  readonly levelId: string;
  readonly levelSlug: string;
  readonly levelTitle: string;
  readonly worldName: string;
  readonly attemptNumber: number;
  readonly status: AttemptStatus;
  readonly score: number | null;
  readonly stars: number | null;
  readonly executionTimeSeconds: number | null;
  readonly blockCount: number | null;
  readonly collisions: number | null;
  readonly errorMessage: string | null;
  readonly submissionId: string | null;
  readonly programId: string | null;
  readonly programVersionId: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

export interface AttemptResult {
  readonly reported?: { objectivesCompleted?: string[]; timeSeconds?: number; collisions?: number; errorMessage?: string };
  readonly objectives?: readonly { code: string; completed: boolean }[];
  readonly criteria?: readonly { id: string; label: string; met: boolean }[];
  readonly reasons?: readonly string[];
}

export interface ProgramVersion {
  readonly id: string;
  readonly versionNumber: number;
  readonly source: 'AUTOSAVE' | 'MANUAL_SAVE' | 'SUBMISSION' | 'RESTORE';
  readonly blockProgram: unknown;
  readonly pythonCode: string | null;
  readonly createdAt: string;
}

export interface AttemptDetail {
  readonly attempt: Attempt & { readonly result: AttemptResult; readonly maxStars: number };
  readonly programVersion: ProgramVersion | null;
  readonly objectives: readonly { code: string; title: string; type: ObjectiveType; required: boolean }[];
}

export interface ProgramSummary {
  readonly id: string;
  readonly studentId: string;
  readonly username: string;
  readonly studentName: string;
  readonly levelId: string;
  readonly levelSlug: string;
  readonly levelTitle: string;
  readonly worldName: string;
  readonly name: string;
  readonly version: number;
  readonly isSubmitted: boolean;
  readonly updatedAt: string;
  readonly attempts: number;
  readonly lastAttemptStatus: AttemptStatus | null;
}

export interface ProgramDetail {
  readonly program: {
    readonly id: string;
    readonly studentId: string;
    readonly username: string;
    readonly studentName: string;
    readonly levelId: string;
    readonly levelSlug: string;
    readonly levelTitle: string;
    readonly name: string;
    readonly version: number;
    readonly isSubmitted: boolean;
    readonly blockProgram: unknown;
    readonly pythonCode: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
  };
  readonly versions: readonly ProgramVersion[];
}

// ── curriculum ──────────────────────────────────────────────────────────
export interface Curriculum {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly thumbnail: string | null;
  readonly status: ContentStatus;
  readonly sortOrder: number;
  readonly worldCount: number;
  readonly updatedAt: string;
}

export interface World {
  readonly id: string;
  readonly curriculumId: string;
  readonly name: string;
  readonly slug: string;
  readonly shortDescription: string | null;
  readonly description: string | null;
  readonly theme: string;
  readonly accentColor: string | null;
  readonly skills: readonly string[];
  readonly difficulty: Difficulty;
  readonly thumbnail: string | null;
  readonly mapPreview: string | null;
  readonly environmentId: string | null;
  readonly mapPosition: Record<string, unknown> | null;
  readonly sortOrder: number;
  readonly status: ContentStatus;
  readonly isVisible: boolean;
  readonly levelCount: number;
  readonly updatedAt: string;
}

export interface Environment {
  readonly id: string;
  readonly name: string;
  readonly kind: 'LEVEL' | 'WORLD_PREVIEW';
  readonly theme: string;
  readonly description: string | null;
  readonly status: ContentStatus;
}

export type RequirementType = 'LEVEL_COMPLETED' | 'LEVEL_STARS' | 'WORLD_COMPLETED' | 'TOTAL_STARS' | 'TOTAL_XP' | 'ACHIEVEMENT';

export interface Requirement {
  readonly type: RequirementType;
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

export interface PrerequisiteGroup {
  readonly groupId: string;
  readonly name: string | null;
  readonly sortOrder: number;
  readonly requirements: readonly Requirement[];
}

export interface LevelSummary {
  readonly id: string;
  readonly worldId: string;
  readonly worldSlug: string;
  readonly worldName: string;
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly sortOrder: number;
  readonly status: ContentStatus;
  readonly visibility: 'VISIBLE' | 'HIDDEN';
  readonly accessMode: AccessMode;
  readonly environmentId: string;
  readonly thumbnail: string | null;
  readonly xpReward: number;
  readonly maxStars: number;
  readonly estimatedMinutes: number | null;
  readonly contentVersion: number;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
  readonly attempts: number;
  readonly studentsStarted: number;
  readonly studentsCompleted: number;
  readonly prerequisites: readonly PrerequisiteGroup[];
}

export interface GraphLevel {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly status: ContentStatus;
  readonly visibility: 'VISIBLE' | 'HIDDEN';
  readonly accessMode: AccessMode;
  readonly sortOrder: number;
  readonly worldId: string;
  readonly worldName: string;
  readonly worldSlug: string;
  readonly worldOrder: number;
  readonly curriculumId: string;
  readonly curriculumName: string;
  readonly prerequisites: readonly PrerequisiteGroup[];
}

export interface Checkpoint {
  readonly id: string;
  readonly levelId: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly position: { x: number; z: number; [k: string]: unknown };
  readonly radius: number;
  readonly required: boolean;
}

export interface Objective {
  readonly id: string;
  readonly levelId: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly type: ObjectiveType;
  readonly checkpointId: string | null;
  readonly config: Record<string, unknown>;
  readonly sortOrder: number;
  readonly required: boolean;
}

export interface Hint {
  readonly id: string;
  readonly levelId: string;
  readonly title: string;
  readonly content: string;
  readonly cost: number;
  readonly sortOrder: number;
}

export interface LevelDetail extends Omit<LevelSummary, 'attempts' | 'studentsStarted' | 'studentsCompleted' | 'worldName'> {
  readonly briefDescription: string | null;
  readonly description: string | null;
  readonly previewImage: string | null;
  readonly parBlocks: number | null;
  readonly parSeconds: number | null;
  readonly allowedBlocks: readonly string[] | null;
  readonly introSteps: readonly string[];
  readonly mapDefinition: Record<string, unknown>;
  readonly sceneConfig: Record<string, unknown>;
  readonly missionSettings: Record<string, unknown>;
  readonly createdAt: string;
  readonly checkpoints: readonly Checkpoint[];
  readonly objectives: readonly Objective[];
  readonly hints: readonly Hint[];
  readonly publishReady: boolean;
  readonly publishProblems: readonly string[];
}

export interface LevelOverride {
  readonly studentId: string;
  readonly username: string;
  readonly displayName: string;
  readonly status: 'LOCKED' | 'AVAILABLE' | 'COMPLETED' | 'DISABLED';
  readonly reason: string | null;
  readonly expiresAt: string | null;
  readonly expired: boolean;
  readonly grantedBy: string | null;
  readonly updatedAt: string;
}

export interface Lesson {
  readonly id: string;
  readonly curriculumId: string;
  readonly worldId: string | null;
  readonly levelId: string | null;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly contentType: LessonContentType;
  readonly content: Record<string, unknown>;
  readonly sortOrder: number;
  readonly status: ContentStatus;
  readonly curriculumName: string | null;
  readonly worldName: string | null;
  readonly levelTitle: string | null;
  readonly updatedAt: string;
}

export type AchievementCriteria =
  | { readonly type: 'complete_levels'; readonly count: number }
  | { readonly type: 'complete_level'; readonly level: string }
  | { readonly type: 'complete_world'; readonly world: string }
  | { readonly type: 'total_stars'; readonly count: number }
  | { readonly type: 'three_star_levels'; readonly count: number }
  | { readonly type: 'streak_days'; readonly count: number }
  | { readonly type: 'use_block'; readonly block: string; readonly inPassedSubmission?: boolean };

export interface Achievement {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly icon: string | null;
  readonly xpReward: number;
  readonly criteria: AchievementCriteria;
  readonly isSecret: boolean;
  readonly sortOrder: number;
  readonly status: ContentStatus;
  readonly unlockedBy: number;
  readonly updatedAt: string;
}

// ── reports ─────────────────────────────────────────────────────────────
export interface ActivityItem {
  readonly type: string;
  readonly at: string;
  readonly actor: string | null;
  readonly actorRole: 'ADMIN' | null;
  readonly studentName: string | null;
  readonly levelTitle: string | null;
  readonly entityName: string | null;
  readonly studentId: string | null;
  readonly levelId: string | null;
}

export interface Dashboard {
  readonly totals: {
    readonly totalStudents: number;
    readonly activeStudents: number;
    readonly levelsPublished: number;
    readonly levelsInReview: number;
    readonly levelsCompleted: number;
    readonly attemptsToday: number;
    readonly completionRate: number;
    readonly avgAttemptsPerLevel: number;
  };
  readonly attemptsByDay: readonly { day: string; attempts: number; passed: number }[];
  readonly recentActivity: readonly ActivityItem[];
}

export interface Statistics {
  readonly totals: { students: number; activeStudents: number; activeLast7Days: number; publishedLevels: number; attempts: number; passedSubmissions: number };
  readonly levels: readonly {
    levelId: string;
    slug: string;
    title: string;
    worldName: string;
    worldId: string;
    status: ContentStatus;
    attempts: number;
    studentsAttempted: number;
    passedAttempts: number;
    passRatePercent: number | null;
    studentsCompleted: number;
    avgBestStars: number | null;
    avgBestTime: number | null;
    avgAttempts: number | null;
  }[];
  readonly worlds: readonly { worldId: string; name: string; status: ContentStatus; publishedLevels: number; completions: number; studentsStarted: number }[];
  readonly daily: readonly { day: string; attempts: number; passed: number; activeStudents: number }[];
  readonly starDistribution: readonly { stars: number; levels: number }[];
}

export interface AuditLog {
  readonly id: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly adminId: string | null;
  readonly adminUsername: string | null;
  readonly adminName: string | null;
  readonly oldData: unknown;
  readonly newData: unknown;
  readonly ipAddress: string | null;
  readonly requestId: string | null;
  readonly createdAt: string;
  readonly studentName: string | null;
  readonly levelTitle: string | null;
  readonly entityName: string | null;
}

export interface StatusChange {
  readonly id: string;
  readonly status: ContentStatus;
  readonly previousStatus: ContentStatus;
  readonly allowedNext: readonly ContentStatus[];
  readonly visibleToStudents?: boolean;
}
