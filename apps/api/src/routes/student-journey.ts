import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.ts';
import { currentUser, requireRole } from '../auth/guard.ts';
import { prerequisitesFor } from '../domain/level-readiness.ts';
import { assertPlayable, levelAccess, levelStates, loadLevelRules } from '../domain/levels.ts';
import { countRunnableBlocks, type Program } from '../domain/program.ts';
import { touchStreak } from '../domain/rewards.ts';
import { findProgram, lockProgress, recordRun, snapshotVersion } from '../domain/runs.ts';
import { loadPlayableLevel, RunSetupSchema, verdictFor } from '../domain/judge.ts';
import { RunReportSchema } from '../domain/scoring.ts';
import { AppError, conflict, notFound, unprocessable } from '../http/errors.ts';
import { UuidParam } from '../http/sql.ts';

/*
 * The student app's journey API:
 *
 *   GET  /api/catalog                 everything the app needs after sign-in, in one request
 *   POST /api/levels/:levelId/runs    Run pressed: a RUNNING attempt with a snapshot of the saved program
 *   POST /api/runs/:runId/finish      the run ended: the server scores it and records progress / rewards
 *
 * The client reports what its simulator showed; the server replays the run
 * (same program version, layout and seed — domain/judge.ts) and decides
 * pass/fail, stars, score, XP and unlocks from what it observed itself.
 */

const LevelParam = z.object({ levelId: z.string().min(1).max(80) }).strict();
const FinishBody = z.object({ outcome: z.enum(['COMPLETED', 'FAILED', 'ERROR', 'STOPPED']), result: RunReportSchema }).strict();

/** Simulated time can't run ahead of the wall clock (time scale 1); slack covers network latency. */
const CLOCK_SLACK_SECONDS = 5;

interface CatalogLevelRow {
  id: string;
  slug: string;
  worldId: string;
  [k: string]: unknown;
}

export function registerStudentJourneyRoutes(app: FastifyInstance, { db }: AppDeps) {
  const student = { preHandler: requireRole('STUDENT') };

  app.get('/api/catalog', student, async (req) => {
    const me = currentUser(req);
    const states = await levelStates(db, me.id);
    const [{ rows: worlds }, { rows: allLevels }, { rows: progress }, { rows: stats }, { rows: last }] = await Promise.all([
      db.query(
        `SELECT w.id, w.slug, w.name, w.short_description AS "shortDescription", w.description, w.theme, w.accent_color AS "accentColor", w.skills,
                w.difficulty, w.map_position AS "mapPosition", c.name AS "curriculumName",
                row_number() OVER (ORDER BY c.sort_order, w.sort_order, w.name)::int AS "order"
           FROM worlds w JOIN curricula c ON c.id = w.curriculum_id
          WHERE w.deleted_at IS NULL AND c.deleted_at IS NULL AND w.status = 'PUBLISHED' AND c.status = 'PUBLISHED' AND w.is_visible
          ORDER BY c.sort_order, w.sort_order, w.name`,
      ),
      db.query<CatalogLevelRow>(
        `SELECT l.id, l.slug, l.world_id AS "worldId", w.slug AS "worldSlug", l.title, l.brief_description AS "briefDescription", l.description,
                l.difficulty, l.sort_order AS "sortOrder", l.environment_id AS "environmentId", l.xp_reward AS "xpReward", l.max_stars AS "maxStars",
                l.par_blocks AS "parBlocks", l.par_seconds AS "parSeconds", l.estimated_minutes AS "estimatedMinutes", l.thumbnail,
                l.preview_image AS "previewImage", l.content_version AS "contentVersion", l.map_definition AS "mapDefinition", l.scene_config AS "sceneConfig",
                l.allowed_blocks AS "allowedBlocks", l.intro_steps AS "introSteps", l.mission_settings AS "missionSettings"
           FROM levels l JOIN worlds w ON w.id = l.world_id
          WHERE l.deleted_at IS NULL ORDER BY w.sort_order, l.sort_order, l.title`,
      ),
      db.query<{ levelId: string }>(
        `SELECT level_id AS "levelId", status, best_stars AS "bestStars", best_score AS "bestScore", best_time_seconds AS "bestTimeSeconds",
                attempt_count AS "attemptCount", completed_at AS "completedAt", last_attempt_at AS "lastAttemptAt"
           FROM student_level_progress WHERE student_id = $1`,
        [me.id],
      ),
      db.query(
        `SELECT total_xp AS "totalXp", total_stars AS "totalStars", levels_completed AS "levelsCompleted", current_streak AS "currentStreak",
                longest_streak AS "longestStreak", last_active_date AS "lastActiveDate" FROM student_stats WHERE student_id = $1`,
        [me.id],
      ),
      db.query<{ slug: string }>(
        `SELECT l.slug FROM student_level_progress p JOIN levels l ON l.id = p.level_id
          WHERE p.student_id = $1 AND p.last_attempt_at IS NOT NULL ORDER BY p.last_attempt_at DESC LIMIT 1`,
        [me.id],
      ),
    ]);

    // Only what students may see: published + visible levels, as decided by get_student_level_states.
    const visible = allLevels.filter((l) => states.has(l.id));
    const playable = visible.filter((l) => !['LOCKED', 'DISABLED'].includes(states.get(l.id)!.state)).map((l) => l.id);
    const locked = visible.filter((l) => states.get(l.id)!.state === 'LOCKED').map((l) => l.id);
    const [{ rows: objectives }, { rows: hints }, prereqs] = await Promise.all([
      db.query<{ levelId: string }>(
        `SELECT o.level_id AS "levelId", o.code, o.title, o.description, o.objective_type AS "type", o.config, o.required, c.code AS "checkpointCode"
           FROM level_objectives o LEFT JOIN level_checkpoints c ON c.id = o.checkpoint_id
          WHERE o.level_id = ANY($1::uuid[]) AND o.deleted_at IS NULL ORDER BY o.sort_order`,
        [playable],
      ),
      db.query<{ levelId: string }>(
        `SELECT h.level_id AS "levelId", h.id, h.title, h.cost, (u.hint_id IS NOT NULL) AS revealed,
                CASE WHEN h.cost = 0 OR u.hint_id IS NOT NULL THEN h.content END AS content
           FROM level_hints h LEFT JOIN student_hint_usage u ON u.hint_id = h.id AND u.student_id = $2
          WHERE h.level_id = ANY($1::uuid[]) AND h.deleted_at IS NULL ORDER BY h.sort_order`,
        [playable, me.id],
      ),
      prerequisitesFor(db, locked),
    ]);
    const byLevel = <T extends { levelId: string }>(rows: T[]) => {
      const m = new Map<string, Omit<T, 'levelId'>[]>();
      for (const { levelId, ...rest } of rows) m.set(levelId, [...(m.get(levelId) ?? []), rest]);
      return m;
    };
    const objectivesBy = byLevel(objectives);
    const hintsBy = byLevel(hints);
    const progressBy = new Map(progress.map(({ levelId, ...p }) => [levelId, p]));

    return {
      student: { id: me.id, username: me.username, displayName: me.displayName, avatarUrl: me.avatarUrl },
      stats: stats[0] ?? { totalXp: 0, totalStars: 0, levelsCompleted: 0, currentStreak: 0, longestStreak: 0, lastActiveDate: null },
      lastLevelSlug: last[0]?.slug ?? null,
      worlds,
      levels: visible.map(({ allowedBlocks, introSteps, missionSettings, ...l }) => {
        const access = states.get(l.id)!;
        const open = playable.includes(l.id);
        return {
          ...l,
          state: access.state,
          lockReason: open ? null : access.reason,
          // Locked levels: which rules unlock them (names included), never their content.
          unlock: access.state === 'LOCKED' ? (prereqs.get(l.id) ?? []) : null,
          progress: progressBy.get(l.id) ?? null,
          content: open ? { allowedBlocks, introSteps, missionSettings, objectives: objectivesBy.get(l.id) ?? [], hints: hintsBy.get(l.id) ?? [] } : null,
        };
      }),
    };
  });

  app.post('/api/levels/:levelId/runs', student, async (req, reply) => {
    const me = currentUser(req);
    const { levelId } = LevelParam.parse(req.params);
    const setup = RunSetupSchema.parse(req.body ?? {});
    const access = await levelAccess(db, me.id, levelId);
    assertPlayable(access);

    const run = await db.tx(async (q) => {
      const program = await findProgram(q, me.id, access.levelId, true);
      if (!program) throw conflict('Save your program before running it.', 'PROGRAM_REQUIRED');
      // A run left unfinished (tab closed, crash) is closed when the next one starts.
      await q.query(
        `UPDATE level_attempts SET status = 'ABORTED', completed_at = CURRENT_TIMESTAMP, result = result || '{"abandoned": true}'::jsonb
          WHERE student_id = $1 AND level_id = $2 AND status = 'RUNNING'`,
        [me.id, access.levelId],
      );
      const version = await snapshotVersion(q, program.id, 'AUTOSAVE');
      const { count } = countRunnableBlocks(version.program);
      const { rows } = await q.query<{ id: string; attemptNumber: number; startedAt: Date }>(
        `INSERT INTO level_attempts (student_id, level_id, program_id, program_version_id, status, block_count, layout_index, seed)
         VALUES ($1, $2, $3, $4, 'RUNNING', $5, $6, $7) RETURNING id, attempt_number AS "attemptNumber", started_at AS "startedAt"`,
        [me.id, access.levelId, program.id, version.versionId, count, setup.layout, setup.seed],
      );
      await lockProgress(q, me.id, access.levelId);
      await q.query(
        'UPDATE student_level_progress SET attempt_count = attempt_count + 1, last_attempt_at = CURRENT_TIMESTAMP, last_program_id = $3 WHERE student_id = $1 AND level_id = $2',
        [me.id, access.levelId, program.id],
      );
      await touchStreak(q, me.id);
      return { ...rows[0]!, blockCount: count, programVersion: version.versionId, layout: setup.layout, seed: setup.seed };
    });
    return reply.status(201).send({ run });
  });

  app.post('/api/runs/:id/finish', student, async (req) => {
    const me = currentUser(req);
    const { id } = UuidParam.parse(req.params);
    const body = FinishBody.parse(req.body);

    const attemptQuery = (lock: boolean) =>
      `SELECT a.level_id AS "levelId", a.status, a.program_id AS "programId", a.program_version_id AS "versionId", a.block_count AS "blockCount",
              a.layout_index AS layout, a.seed, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - a.started_at))::float8 AS elapsed, v.block_program AS "blockProgram"
         FROM level_attempts a JOIN program_versions v ON v.id = a.program_version_id
        WHERE a.id = $1 AND a.student_id = $2 ${lock ? 'FOR UPDATE OF a' : ''}`;
    type AttemptRow = { levelId: string; status: string; programId: string; versionId: string; blockCount: number; layout: number; seed: number; elapsed: number; blockProgram: Program };
    const checkRunning = (attempt: AttemptRow | undefined): AttemptRow => {
      // Another student's run is indistinguishable from a missing one.
      if (!attempt) throw notFound('Run');
      if (attempt.status !== 'RUNNING') throw new AppError(409, 'RUN_FINISHED', 'This run has already been recorded.');
      return attempt;
    };

    // Judge first, outside the transaction: the replay is CPU work and must not hold row locks.
    const pre = checkRunning((await db.query<AttemptRow>(attemptQuery(false), [id, me.id])).rows[0]);
    if (body.result.timeSeconds > pre.elapsed + CLOCK_SLACK_SECONDS) {
      throw unprocessable('IMPLAUSIBLE_RESULT', 'The run reports more time than has passed since it started.', { elapsedSeconds: Math.round(pre.elapsed) });
    }
    const rules = await loadLevelRules(db, pre.levelId);
    const verdict = verdictFor({
      rules,
      level: await loadPlayableLevel(db, pre.levelId),
      program: pre.blockProgram,
      setup: { layout: pre.layout, seed: pre.seed },
      claimed: body.result,
      clientOutcome: body.outcome,
      blockCount: pre.blockCount,
      // Simulated time can't exceed the wall-clock time since the run started.
      maxSeconds: pre.elapsed + CLOCK_SLACK_SECONDS,
    });

    return db.tx(async (q) => {
      const attempt = checkRunning((await q.query<AttemptRow>(attemptQuery(true), [id, me.id])).rows[0]);
      const access = await levelAccess(q, me.id, attempt.levelId);
      assertPlayable(access);
      const { types } = countRunnableBlocks(attempt.blockProgram);
      const { scored } = verdict;
      const run = await recordRun(q, {
        studentId: me.id,
        levelId: attempt.levelId,
        programId: attempt.programId,
        versionId: attempt.versionId,
        blockCount: attempt.blockCount,
        blockTypes: types,
        rules,
        report: verdict.report,
        claimed: body.result,
        judge: verdict.judge,
        scored,
        attemptId: id,
        failedStatus: verdict.failedStatus,
        countAttempt: false,
        recordFailedSubmission: false,
      });
      const { rows: objectives } = await q.query<{ code: string; title: string; required: boolean; type: string }>(
        `SELECT code, title, required, objective_type AS type FROM level_objectives WHERE level_id = $1 AND deleted_at IS NULL ORDER BY sort_order`,
        [attempt.levelId],
      );
      const done = new Map(scored.objectives.map((o) => [o.code, o.completed]));
      return {
        run: { id: run.attemptId, attemptNumber: run.attemptNumber, status: run.status },
        passed: run.passed,
        stars: run.stars,
        maxStars: rules.maxStars,
        score: run.score,
        xpEarned: run.xpEarned,
        newBest: run.newBest,
        firstCompletion: run.firstCompletion,
        blockCount: attempt.blockCount,
        criteria: scored.criteria,
        reasons: scored.reasons,
        objectives: objectives.map((o) => ({ ...o, completed: done.get(o.code) ?? false })),
        achievementsUnlocked: run.achievementsUnlocked,
        unlockedLevels: run.unlockedLevels,
        stats: run.stats,
      };
    });
  });
}
