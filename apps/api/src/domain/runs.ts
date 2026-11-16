import type { Queryable } from '../db/db.ts';
import type { LevelState } from './levels.ts';
import { levelStates } from './levels.ts';
import type { Program } from './program.ts';
import { evaluateAchievements, touchStreak } from './rewards.ts';
import type { LevelRules, RunReport, Scored } from './scoring.ts';

/*
 * Recording a finished run: the attempt row, and — when the server's scoring
 * says the mission passed — the submission, progress, star / XP ledgers,
 * objective progress, achievements and newly unlocked levels. Shared by
 * POST /api/levels/:id/submissions and POST /api/runs/:id/finish, always
 * inside the caller's transaction.
 */

/** The student's program for a level (the "Main" program), if any. */
export async function findProgram(q: Queryable, studentId: string, levelId: string, lock = false) {
  const { rows } = await q.query<{ id: string; name: string; blockProgram: Program; pythonCode: string | null; version: number; isSubmitted: boolean; updatedAt: Date }>(
    `SELECT id, name, block_program AS "blockProgram", python_code AS "pythonCode", version, is_submitted AS "isSubmitted", updated_at AS "updatedAt"
       FROM programs WHERE student_id = $1 AND level_id = $2 AND name = 'Main' AND deleted_at IS NULL ${lock ? 'FOR UPDATE' : ''}`,
    [studentId, levelId],
  );
  return rows[0] ?? null;
}

/** Latest saved version of a program; snapshots the current program first if it changed. */
export async function snapshotVersion(q: Queryable, programId: string, source: 'AUTOSAVE' | 'SUBMISSION') {
  const { rows } = await q.query<{ id: string; block_program: Program; changed: boolean }>(
    `SELECT v.id, p.block_program, (v.id IS NULL OR v.block_program IS DISTINCT FROM p.block_program OR v.python_code IS DISTINCT FROM p.python_code) AS changed
       FROM programs p LEFT JOIN program_versions v ON v.program_id = p.id AND v.version_number = p.version
      WHERE p.id = $1`,
    [programId],
  );
  const row = rows[0]!;
  if (!row.changed) return { versionId: row.id, program: row.block_program };
  const { rows: v } = await q.query<{ id: string; block_program: Program }>(
    // Called in FROM so the (volatile) function runs exactly once.
    `SELECT v.id, v.block_program FROM programs p, LATERAL save_program_version(p.id, p.block_program, p.python_code, $2::program_version_source) v WHERE p.id = $1`,
    [programId, source],
  );
  return { versionId: v[0]!.id, program: v[0]!.block_program };
}

/** Ensures a progress row exists (IN_PROGRESS once started) and locks it. */
export async function lockProgress(q: Queryable, studentId: string, levelId: string) {
  await q.query(
    `INSERT INTO student_level_progress (student_id, level_id, status, first_started_at) VALUES ($1, $2, 'IN_PROGRESS', CURRENT_TIMESTAMP)
     ON CONFLICT (student_id, level_id) DO NOTHING`,
    [studentId, levelId],
  );
  const { rows } = await q.query<{ id: string; status: string; best_stars: number; best_score: number | null; best_time_seconds: number | null; completed_at: Date | null }>(
    'SELECT id, status, best_stars, best_score, best_time_seconds, completed_at FROM student_level_progress WHERE student_id = $1 AND level_id = $2 FOR UPDATE',
    [studentId, levelId],
  );
  return rows[0]!;
}

export interface RunInput {
  readonly studentId: string;
  readonly levelId: string;
  readonly programId: string;
  readonly versionId: string;
  readonly blockCount: number;
  readonly blockTypes: ReadonlySet<string>;
  readonly rules: LevelRules & { readonly xpReward: number };
  readonly report: RunReport;
  readonly scored: Scored;
  /** Finalise this RUNNING attempt instead of inserting a new one. */
  readonly attemptId?: string;
  /** Status for a run that didn't pass (client stop / runtime error); default FAILED. */
  readonly failedStatus?: 'FAILED' | 'ERROR' | 'ABORTED';
  /** Add this run to the progress attempt count (false when it was counted at start). */
  readonly countAttempt: boolean;
  /** Also keep a FAILED submission row (explicit submissions only). */
  readonly recordFailedSubmission: boolean;
}

export interface RunOutcome {
  readonly passed: boolean;
  readonly status: 'PASSED' | 'FAILED' | 'ERROR' | 'ABORTED';
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly submissionId: string | null;
  readonly stars: number;
  readonly score: number;
  readonly xpEarned: number;
  readonly newBest: boolean;
  readonly firstCompletion: boolean;
  readonly achievementsUnlocked: string[];
  readonly unlockedLevels: { id: string; slug: string }[];
  readonly stats: { totalXp: number; totalStars: number; levelsCompleted: number; currentStreak: number } | null;
}

export async function recordRun(q: Queryable, r: RunInput): Promise<RunOutcome> {
  const { studentId: me, levelId, scored, report } = r;
  const before = await levelStates(q, me);
  const progress = await lockProgress(q, me, levelId);
  const passed = scored.passed;
  const status = passed ? 'PASSED' : (r.failedStatus ?? 'FAILED');
  const firstCompletion = passed && progress.status !== 'COMPLETED';
  const newBest = passed && scored.stars > progress.best_stars;
  const resultJson = JSON.stringify({ reported: report, objectives: scored.objectives, criteria: scored.criteria, reasons: scored.reasons });

  let submissionId: string | null = null;
  if (passed || r.recordFailedSubmission) {
    const { rows } = await q.query<{ id: string }>(
      `INSERT INTO submissions (student_id, level_id, program_id, program_version_id, status, score, stars, xp_earned, execution_time_seconds, block_count, result, submitted_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
      [me, levelId, r.programId, r.versionId, passed ? 'PASSED' : 'FAILED', scored.score, scored.stars, report.timeSeconds, r.blockCount, resultJson],
    );
    submissionId = rows[0]!.id;
  }

  const stars = passed ? scored.stars : null;
  const score = passed ? scored.score : null;
  const { rows: att } = r.attemptId
    ? await q.query<{ id: string; attemptNumber: number }>(
        `UPDATE level_attempts SET status = $2::attempt_status, submission_id = $3, score = $4, stars = $5, execution_time_seconds = $6, collisions = $7,
                error_message = $8, result = $9::jsonb, completed_at = CURRENT_TIMESTAMP
          WHERE id = $1 RETURNING id, attempt_number AS "attemptNumber"`,
        [r.attemptId, status, submissionId, score, stars, report.timeSeconds, report.collisions, report.errorMessage ?? null, resultJson],
      )
    : await q.query<{ id: string; attemptNumber: number }>(
        `INSERT INTO level_attempts (student_id, level_id, program_id, program_version_id, submission_id, status, score, stars, execution_time_seconds, block_count,
                                     collisions, error_message, result, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6::attempt_status, $7, $8, $9, $10, $11, $12, $13::jsonb, CURRENT_TIMESTAMP)
         RETURNING id, attempt_number AS "attemptNumber"`,
        [me, levelId, r.programId, r.versionId, submissionId, status, score, stars, report.timeSeconds, r.blockCount, report.collisions, report.errorMessage ?? null, resultJson],
      );
  const attempt = att[0]!;

  let xpEarned = 0;
  const bump = r.countAttempt ? 'attempt_count = attempt_count + 1,' : '';
  if (passed) {
    await q.query(
      `UPDATE student_level_progress SET
         status = 'COMPLETED', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
         best_stars = GREATEST(best_stars, $3), best_score = GREATEST(COALESCE(best_score, 0), $4),
         best_time_seconds = LEAST(COALESCE(best_time_seconds, $5), $5),
         ${bump} last_attempt_at = CURRENT_TIMESTAMP, last_program_id = $6
       WHERE student_id = $1 AND level_id = $2`,
      [me, levelId, scored.stars, scored.score, report.timeSeconds, r.programId],
    );
    if (newBest) {
      await q.query('INSERT INTO star_transactions (student_id, level_id, submission_id, stars_before, stars_after) VALUES ($1, $2, $3, $4, $5)', [
        me,
        levelId,
        submissionId,
        progress.best_stars,
        scored.stars,
      ]);
    }
    if (firstCompletion && r.rules.xpReward > 0) {
      // The partial unique index makes level-completion XP payable once, whatever happens.
      const { rowCount } = await q.query(
        `INSERT INTO xp_transactions (student_id, amount, source_type, source_id, description)
         SELECT $1, $2, 'LEVEL_COMPLETION', $3, 'Completed ' || title FROM levels WHERE id = $3
         ON CONFLICT DO NOTHING`,
        [me, r.rules.xpReward, levelId],
      );
      if (rowCount) xpEarned = r.rules.xpReward;
    }
    await q.query('UPDATE submissions SET xp_earned = $2 WHERE id = $1', [submissionId, xpEarned]);
    await q.query(
      `INSERT INTO student_objective_progress (student_id, objective_id, completed, completed_at, first_attempt_id)
       SELECT $1, o.id, TRUE, CURRENT_TIMESTAMP, $4 FROM level_objectives o
        WHERE o.level_id = $2 AND o.deleted_at IS NULL AND o.code = ANY($3::text[])
       ON CONFLICT (student_id, objective_id) DO UPDATE SET completed = TRUE, completed_at = COALESCE(student_objective_progress.completed_at, EXCLUDED.completed_at)`,
      [me, levelId, scored.objectives.filter((o) => o.completed).map((o) => o.code), attempt.id],
    );
    await q.query('UPDATE programs SET is_submitted = TRUE WHERE id = $1', [r.programId]);
  } else {
    await q.query(`UPDATE student_level_progress SET ${bump} last_attempt_at = CURRENT_TIMESTAMP, last_program_id = $3 WHERE student_id = $1 AND level_id = $2`, [
      me,
      levelId,
      r.programId,
    ]);
  }
  await touchStreak(q, me);
  const achievementsUnlocked = passed ? await evaluateAchievements(q, me, { usedBlockTypes: r.blockTypes }) : [];

  const after = await levelStates(q, me);
  const opened = (s: LevelState | undefined) => s === 'AVAILABLE' || s === 'IN_PROGRESS' || s === 'COMPLETED';
  const newlyOpen = [...after.values()].filter((s) => opened(s.state) && !opened(before.get(s.levelId)?.state)).map((s) => s.levelId);
  const { rows: slugs } = newlyOpen.length
    ? await q.query<{ id: string; slug: string }>('SELECT id, slug FROM levels WHERE id = ANY($1::uuid[])', [newlyOpen])
    : { rows: [] as { id: string; slug: string }[] };
  const { rows: stats } = await q.query<RunOutcome['stats'] & object>(
    `SELECT total_xp AS "totalXp", total_stars AS "totalStars", levels_completed AS "levelsCompleted", current_streak AS "currentStreak" FROM student_stats WHERE student_id = $1`,
    [me],
  );
  return {
    passed,
    status,
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    submissionId,
    stars: passed ? scored.stars : 0,
    score: passed ? scored.score : 0,
    xpEarned,
    newBest,
    firstCompletion,
    achievementsUnlocked,
    unlockedLevels: slugs,
    stats: stats[0] ?? null,
  };
}
