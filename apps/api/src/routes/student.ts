import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.ts';
import { currentUser, requireRole } from '../auth/guard.ts';
import type { Queryable } from '../db/db.ts';
import { assertPlayable, isUuid, levelAccess, levelStates, loadLevelRules, type LevelAccess } from '../domain/levels.ts';
import { countRunnableBlocks, LIMITS, validateProgram } from '../domain/program.ts';
import { touchStreak } from '../domain/rewards.ts';
import { findProgram, lockProgress, recordRun, snapshotVersion } from '../domain/runs.ts';
import { RunSetupSchema, savedProgramJudge } from '../domain/judge.ts';
import { RunReportSchema } from '../domain/scoring.ts';
import { AppError, conflict, notFound } from '../http/errors.ts';

const LevelParam = z.object({ levelId: z.string().min(1).max(80) }).strict();
const WorldParam = z.object({ id: z.string().min(1).max(80) }).strict();

const SaveProgramBody = z
  .object({
    blockProgram: z.unknown(),
    pythonCode: z.string().max(LIMITS.maxPythonBytes).nullable().optional(),
    /** Keep a version snapshot (explicit Save / Test in Simulator); autosaves omit it. */
    createVersion: z.boolean().optional(),
  })
  .strict();

const AttemptBody = z
  .object({ status: z.enum(['PASSED', 'FAILED', 'ERROR', 'ABORTED']), result: RunReportSchema })
  .extend(RunSetupSchema.shape)
  .strict();
const SubmissionBody = z.object({ result: RunReportSchema }).extend(RunSetupSchema.shape).strict();
/** The attempts route's status as a client outcome. */
const CLIENT_OUTCOME = { PASSED: 'COMPLETED', FAILED: 'FAILED', ERROR: 'ERROR', ABORTED: 'STOPPED' } as const;

const SettingsBody = z
  .object({
    soundEnabled: z.boolean(),
    volume: z.number().min(0).max(1),
    musicEnabled: z.boolean(),
    reducedMotion: z.boolean().nullable(),
    graphicsQuality: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    showSensorVisualization: z.boolean(),
    showHints: z.boolean(),
    language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  })
  .partial()
  .strict();

const LEVEL_SUMMARY = `l.id, l.slug, l.title, l.brief_description AS "briefDescription", l.difficulty, l.sort_order AS "sortOrder",
  l.environment_id AS "environmentId", l.xp_reward AS "xpReward", l.max_stars AS "maxStars", l.estimated_minutes AS "estimatedMinutes",
  l.thumbnail, l.preview_image AS "previewImage", l.world_id AS "worldId"`;

const WORLD_FIELDS = `w.id, w.curriculum_id AS "curriculumId", w.name, w.slug, w.short_description AS "shortDescription", w.description, w.theme,
  w.accent_color AS "accentColor", w.skills, w.difficulty, w.thumbnail, w.map_preview AS "mapPreview", w.environment_id AS "environmentId",
  w.map_position AS "mapPosition", w.sort_order AS "sortOrder"`;

const PROGRESS_FIELDS = `p.status, p.best_score AS "bestScore", p.best_stars AS "bestStars", p.best_time_seconds AS "bestTimeSeconds",
  p.attempt_count AS "attemptCount", p.completed_at AS "completedAt", p.last_attempt_at AS "lastAttemptAt"`;

interface LevelSummary {
  id: string;
  worldId: string;
  maxStars: number;
  [k: string]: unknown;
}

/** Visible levels (published, visible, world visible) with the student's state and progress. */
async function visibleLevels(q: Queryable, studentId: string, worldId: string | null = null) {
  const states = await levelStates(q, studentId);
  const { rows } = await q.query<LevelSummary & { progress: unknown }>(
    `SELECT ${LEVEL_SUMMARY},
            CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('status', p.status, 'bestStars', p.best_stars, 'bestScore', p.best_score,
              'bestTimeSeconds', p.best_time_seconds, 'attemptCount', p.attempt_count, 'completedAt', p.completed_at) END AS progress
       FROM levels l
       LEFT JOIN student_level_progress p ON p.level_id = l.id AND p.student_id = $1
      WHERE l.deleted_at IS NULL AND ($2::uuid IS NULL OR l.world_id = $2::uuid)
      ORDER BY l.sort_order, l.title`,
    [studentId, worldId],
  );
  return rows.filter((l) => states.has(l.id)).map((l) => ({ ...l, state: states.get(l.id)!.state, lockReason: lockReason(states.get(l.id)!) }));
}

const lockReason = (a: LevelAccess) => (a.state === 'LOCKED' || a.state === 'DISABLED' ? a.reason : null);

/** Aggregate state of a world for the map (derived from its levels). */
function worldSummary(levels: { state: string; progress: unknown; maxStars: unknown }[]) {
  const done = levels.filter((l) => l.state === 'COMPLETED').length;
  const stars = levels.reduce((s, l) => s + Number((l.progress as { bestStars?: number } | null)?.bestStars ?? 0), 0);
  const state =
    levels.length === 0 ? 'COMING_SOON' : done === levels.length ? 'COMPLETED' : levels.every((l) => l.state === 'LOCKED' || l.state === 'DISABLED') ? 'LOCKED' : levels.some((l) => l.state !== 'AVAILABLE' && l.state !== 'LOCKED') ? 'IN_PROGRESS' : 'AVAILABLE';
  return { state, levelsTotal: levels.length, levelsCompleted: done, starsEarned: stars, maxStars: levels.reduce((s, l) => s + Number(l.maxStars), 0) };
}

async function publishedWorlds(q: Queryable, where = '', params: unknown[] = []) {
  const { rows } = await q.query<{ id: string; [k: string]: unknown }>(
    `SELECT ${WORLD_FIELDS} FROM worlds w JOIN curricula c ON c.id = w.curriculum_id
      WHERE w.deleted_at IS NULL AND c.deleted_at IS NULL AND w.status = 'PUBLISHED' AND c.status = 'PUBLISHED' AND w.is_visible ${where}
      ORDER BY c.sort_order, w.sort_order`,
    params,
  );
  return rows;
}

export function registerStudentRoutes(app: FastifyInstance, { db }: AppDeps) {
  const student = { preHandler: requireRole('STUDENT') };

  // ── catalog ────────────────────────────────────────────────────────────
  app.get('/api/curriculum', student, async (req) => {
    const me = currentUser(req);
    const { rows: curricula } = await db.query<{ id: string }>(
      `SELECT id, name, slug, description, thumbnail, sort_order AS "sortOrder" FROM curricula
        WHERE status = 'PUBLISHED' AND deleted_at IS NULL ORDER BY sort_order, name`,
    );
    const worlds = await publishedWorlds(db);
    const levels = await visibleLevels(db, me.id);
    return {
      curricula: curricula.map((c) => ({
        ...c,
        worlds: worlds
          .filter((w) => w.curriculumId === c.id)
          .map((w) => {
            const own = levels.filter((l) => l.worldId === w.id);
            return { ...w, ...worldSummary(own), levels: own };
          }),
      })),
    };
  });

  app.get('/api/worlds', student, async (req) => {
    const me = currentUser(req);
    const worlds = await publishedWorlds(db);
    const levels = await visibleLevels(db, me.id);
    return { worlds: worlds.map((w) => ({ ...w, ...worldSummary(levels.filter((l) => l.worldId === w.id)) })) };
  });

  app.get('/api/worlds/:id', student, async (req) => {
    const me = currentUser(req);
    const { id } = WorldParam.parse(req.params);
    const [world] = await publishedWorlds(db, `AND ${isUuid(id) ? 'w.id = $1::uuid' : 'w.slug = $1'}`, [id]);
    if (!world) throw notFound('World');
    const levels = await visibleLevels(db, me.id, world.id);
    return { world: { ...world, ...worldSummary(levels) }, levels };
  });

  app.get('/api/lessons', student, async (req) => {
    const query = z.object({ worldId: z.uuid().optional(), levelId: z.uuid().optional() }).strict().parse(req.query);
    const { rows } = await db.query(
      `SELECT ls.id, ls.world_id AS "worldId", ls.level_id AS "levelId", ls.title, ls.slug, ls.description, ls.content_type AS "contentType", ls.content, ls.sort_order AS "sortOrder"
         FROM lessons ls JOIN curricula c ON c.id = ls.curriculum_id
        WHERE ls.status = 'PUBLISHED' AND ls.deleted_at IS NULL AND c.status = 'PUBLISHED'
          AND ($1::uuid IS NULL OR ls.world_id = $1) AND ($2::uuid IS NULL OR ls.level_id = $2)
        ORDER BY ls.sort_order`,
      [query.worldId ?? null, query.levelId ?? null],
    );
    return { lessons: rows };
  });

  app.get('/api/levels/:levelId', student, async (req) => {
    const me = currentUser(req);
    const { levelId } = LevelParam.parse(req.params);
    const access = await levelAccess(db, me.id, levelId);
    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT ${LEVEL_SUMMARY}, l.description, l.intro_steps AS "introSteps", l.par_blocks AS "parBlocks", l.par_seconds AS "parSeconds",
              l.allowed_blocks AS "allowedBlocks", l.map_definition AS "mapDefinition", l.scene_config AS "sceneConfig",
              l.mission_settings AS "missionSettings", l.content_version AS "contentVersion", w.slug AS "worldSlug", w.name AS "worldName"
         FROM levels l JOIN worlds w ON w.id = l.world_id WHERE l.id = $1`,
      [access.levelId],
    );
    const level = rows[0]!;
    const { rows: progress } = await db.query(`SELECT ${PROGRESS_FIELDS} FROM student_level_progress p WHERE p.student_id = $1 AND p.level_id = $2`, [me.id, access.levelId]);
    const summary = {
      id: level.id, slug: level.slug, title: level.title, briefDescription: level.briefDescription, difficulty: level.difficulty,
      worldId: level.worldId, worldSlug: level.worldSlug, worldName: level.worldName, environmentId: level.environmentId,
      xpReward: level.xpReward, maxStars: level.maxStars, estimatedMinutes: level.estimatedMinutes, thumbnail: level.thumbnail, previewImage: level.previewImage,
    };
    const base = { ...summary, state: access.state, lockReason: lockReason(access), progress: progress[0] ?? null };
    // Locked levels show their card, not their content.
    if (access.state === 'LOCKED' || access.state === 'DISABLED') return { level: base };

    const [{ rows: objectives }, { rows: checkpoints }, { rows: hints }] = await Promise.all([
      db.query(
        `SELECT o.id, o.code, o.title, o.description, o.objective_type AS "type", o.config, o.required, o.sort_order AS "sortOrder", c.code AS "checkpointCode"
           FROM level_objectives o LEFT JOIN level_checkpoints c ON c.id = o.checkpoint_id
          WHERE o.level_id = $1 AND o.deleted_at IS NULL ORDER BY o.sort_order`,
        [access.levelId],
      ),
      db.query(
        `SELECT code, name, description, sort_order AS "sortOrder", position, radius, required FROM level_checkpoints
          WHERE level_id = $1 AND deleted_at IS NULL ORDER BY sort_order`,
        [access.levelId],
      ),
      db.query(
        `SELECT h.id, h.title, h.cost, h.sort_order AS "sortOrder", (u.hint_id IS NOT NULL) AS revealed,
                CASE WHEN h.cost = 0 OR u.hint_id IS NOT NULL THEN h.content END AS content
           FROM level_hints h LEFT JOIN student_hint_usage u ON u.hint_id = h.id AND u.student_id = $2
          WHERE h.level_id = $1 AND h.deleted_at IS NULL ORDER BY h.sort_order`,
        [access.levelId, me.id],
      ),
    ]);
    return {
      level: {
        ...base,
        description: level.description,
        introSteps: level.introSteps,
        parBlocks: level.parBlocks,
        parSeconds: level.parSeconds,
        allowedBlocks: level.allowedBlocks,
        mapDefinition: level.mapDefinition,
        sceneConfig: level.sceneConfig,
        missionSettings: level.missionSettings,
        contentVersion: level.contentVersion,
        objectives,
        checkpoints,
        hints,
      },
    };
  });

  app.post('/api/levels/:levelId/hints/:hintId/reveal', student, async (req) => {
    const me = currentUser(req);
    const params = z.object({ levelId: z.string().min(1).max(80), hintId: z.uuid() }).strict().parse(req.params);
    const access = await levelAccess(db, me.id, params.levelId);
    assertPlayable(access);
    return db.tx(async (q) => {
      const { rows } = await q.query<{ id: string; title: string; content: string; cost: number }>(
        'SELECT id, title, content, cost FROM level_hints WHERE id = $1 AND level_id = $2 AND deleted_at IS NULL',
        [params.hintId, access.levelId],
      );
      const hint = rows[0];
      if (!hint) throw notFound('Hint');
      const { rowCount } = await q.query('INSERT INTO student_hint_usage (student_id, hint_id, xp_cost) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [me.id, hint.id, hint.cost]);
      if (rowCount && hint.cost > 0) {
        const { rows: stats } = await q.query<{ total_xp: number }>('SELECT total_xp FROM student_stats WHERE student_id = $1 FOR UPDATE', [me.id]);
        if ((stats[0]?.total_xp ?? 0) < hint.cost) throw new AppError(409, 'NOT_ENOUGH_XP', `This hint costs ${hint.cost} XP.`);
        await q.query(`INSERT INTO xp_transactions (student_id, amount, source_type, source_id, description) VALUES ($1, $2, 'HINT_PURCHASE', $3, $4)`, [
          me.id,
          -hint.cost,
          hint.id,
          `Hint: ${hint.title}`,
        ]);
      }
      if (rowCount) {
        await q.query(
          `INSERT INTO student_level_progress (student_id, level_id, status, first_started_at, hints_used) VALUES ($1, $2, 'IN_PROGRESS', CURRENT_TIMESTAMP, 1)
           ON CONFLICT (student_id, level_id) DO UPDATE SET hints_used = student_level_progress.hints_used + 1`,
          [me.id, access.levelId],
        );
      }
      return { hint: { id: hint.id, title: hint.title, content: hint.content, cost: hint.cost, revealed: true } };
    });
  });

  // ── programs ───────────────────────────────────────────────────────────
  app.get('/api/levels/:levelId/program', student, async (req) => {
    const me = currentUser(req);
    const { levelId } = LevelParam.parse(req.params);
    const access = await levelAccess(db, me.id, levelId);
    return { program: await findProgram(db, me.id, access.levelId) };
  });

  app.put('/api/levels/:levelId/program', { ...student, bodyLimit: 320 * 1024 }, async (req) => {
    const me = currentUser(req);
    const { levelId } = LevelParam.parse(req.params);
    const body = SaveProgramBody.parse(req.body);
    const access = await levelAccess(db, me.id, levelId);
    assertPlayable(access);
    const { allowedBlocks } = await loadLevelRules(db, access.levelId);
    const program = validateProgram(body.blockProgram, allowedBlocks);
    const python = body.pythonCode ?? null;
    if (python !== null && Buffer.byteLength(python) > LIMITS.maxPythonBytes) throw new AppError(422, 'PROGRAM_TOO_LARGE', 'The Python code is too long.');

    return db.tx(async (q) => {
      let existing = await findProgram(q, me.id, access.levelId, true);
      if (!existing) {
        await q.query(`INSERT INTO programs (student_id, level_id, name, block_program, python_code) VALUES ($1, $2, 'Main', $3::jsonb, $4)`, [
          me.id,
          access.levelId,
          JSON.stringify(program),
          python,
        ]);
        existing = await findProgram(q, me.id, access.levelId, true);
      } else {
        await q.query('UPDATE programs SET block_program = $2::jsonb, python_code = $3 WHERE id = $1', [existing.id, JSON.stringify(program), python]);
      }
      if (body.createVersion) await q.query(`SELECT save_program_version($1, $2::jsonb, $3, 'MANUAL_SAVE')`, [existing!.id, JSON.stringify(program), python]);
      await q.query(
        `INSERT INTO student_level_progress (student_id, level_id, status, first_started_at, last_program_id) VALUES ($1, $2, 'IN_PROGRESS', CURRENT_TIMESTAMP, $3)
         ON CONFLICT (student_id, level_id) DO UPDATE SET last_program_id = EXCLUDED.last_program_id`,
        [me.id, access.levelId, existing!.id],
      );
      return { program: await findProgram(q, me.id, access.levelId) };
    });
  });

  // ── runs ───────────────────────────────────────────────────────────────
  /** A run that didn't complete the mission (or any run the client wants logged). Never awards anything. */
  app.post('/api/levels/:levelId/attempts', student, async (req, reply) => {
    const me = currentUser(req);
    const { levelId } = LevelParam.parse(req.params);
    const body = AttemptBody.parse(req.body);
    const access = await levelAccess(db, me.id, levelId);
    assertPlayable(access);
    const rules = await loadLevelRules(db, access.levelId);
    const setup = { layout: body.layout, seed: body.seed };
    const judge = await savedProgramJudge(db, me.id, access.levelId, rules, setup, body.result, CLIENT_OUTCOME[body.status]);

    const attempt = await db.tx(async (q) => {
      const program = await findProgram(q, me.id, access.levelId, true);
      if (!program) throw conflict('Save your program before running it.', 'PROGRAM_REQUIRED');
      const version = await snapshotVersion(q, program.id, 'AUTOSAVE');
      const { verdict, count } = judge(version.program);
      const { scored, report } = verdict;
      // The server decides PASSED / FAILED / ERROR from its replay; a run the student stopped stays ABORTED.
      const status = scored.passed ? 'PASSED' : body.status === 'ABORTED' ? 'ABORTED' : verdict.failedStatus;
      const { rows } = await q.query<{ id: string; attemptNumber: number }>(
        `INSERT INTO level_attempts (student_id, level_id, program_id, program_version_id, status, score, stars, execution_time_seconds, block_count, collisions, error_message, result,
                                     layout_index, seed, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, CURRENT_TIMESTAMP)
         RETURNING id, attempt_number AS "attemptNumber"`,
        [
          me.id, access.levelId, program.id, version.versionId, status, status === 'PASSED' ? scored.score : null, status === 'PASSED' ? scored.stars : null,
          report.timeSeconds, count, report.collisions, report.errorMessage ?? null,
          JSON.stringify({ reported: body.result, judged: report, judge: verdict.judge, objectives: scored.objectives, criteria: scored.criteria, reasons: scored.reasons }),
          setup.layout, setup.seed,
        ],
      );
      await lockProgress(q, me.id, access.levelId);
      await q.query(
        'UPDATE student_level_progress SET attempt_count = attempt_count + 1, last_attempt_at = CURRENT_TIMESTAMP, last_program_id = $3 WHERE student_id = $1 AND level_id = $2',
        [me.id, access.levelId, program.id],
      );
      await touchStreak(q, me.id);
      return { ...rows[0]!, status, stars: status === 'PASSED' ? scored.stars : 0, blockCount: count, reasons: scored.reasons };
    });
    return reply.status(201).send({ attempt });
  });

  /**
   * "I finished the mission": the server re-derives pass/fail, stars, score
   * and XP from the stored program and the level's rules, then records the
   * submission, progress, ledgers and any achievements — all in one transaction.
   */
  app.post('/api/levels/:levelId/submissions', student, async (req, reply) => {
    const me = currentUser(req);
    const { levelId } = LevelParam.parse(req.params);
    const body = SubmissionBody.parse(req.body);
    const access = await levelAccess(db, me.id, levelId);
    assertPlayable(access);
    const rules = await loadLevelRules(db, access.levelId);
    const setup = { layout: body.layout, seed: body.seed };
    const judge = await savedProgramJudge(db, me.id, access.levelId, rules, setup, body.result, 'COMPLETED');

    const outcome = await db.tx(async (q) => {
      const program = await findProgram(q, me.id, access.levelId, true);
      if (!program) throw conflict('Save your program before submitting it.', 'PROGRAM_REQUIRED');
      const version = await snapshotVersion(q, program.id, 'SUBMISSION');
      const { verdict, count, types } = judge(version.program);
      const { scored } = verdict;
      const run = await recordRun(q, {
        studentId: me.id,
        levelId: access.levelId,
        programId: program.id,
        versionId: version.versionId,
        blockCount: count,
        blockTypes: types,
        rules,
        report: verdict.report,
        claimed: body.result,
        judge: verdict.judge,
        scored,
        countAttempt: true,
        recordFailedSubmission: true,
      });
      return {
        submission: { id: run.submissionId, status: run.passed ? 'PASSED' : 'FAILED', stars: scored.stars, score: scored.score, xpEarned: run.xpEarned, blockCount: count, executionTimeSeconds: verdict.report.timeSeconds },
        criteria: scored.criteria,
        reasons: scored.reasons,
        newBest: run.newBest,
        achievementsUnlocked: run.achievementsUnlocked,
        unlockedLevels: run.unlockedLevels.map((l) => l.id),
        stats: run.stats,
      };
    });
    return reply.status(201).send(outcome);
  });

  // ── me ─────────────────────────────────────────────────────────────────
  app.get('/api/me/progress', student, async (req) => {
    const me = currentUser(req);
    const [{ rows: stats }, { rows: levels }, { rows: xp }] = await Promise.all([
      db.query(
        `SELECT total_xp AS "totalXp", total_stars AS "totalStars", levels_completed AS "levelsCompleted", current_streak AS "currentStreak",
                longest_streak AS "longestStreak", last_active_date AS "lastActiveDate" FROM student_stats WHERE student_id = $1`,
        [me.id],
      ),
      db.query(
        `SELECT l.id AS "levelId", l.slug, l.title, w.slug AS "worldSlug", ${PROGRESS_FIELDS}
           FROM student_level_progress p JOIN levels l ON l.id = p.level_id JOIN worlds w ON w.id = l.world_id
          WHERE p.student_id = $1 ORDER BY w.sort_order, l.sort_order`,
        [me.id],
      ),
      db.query(
        `SELECT amount, source_type AS "sourceType", description, created_at AS "createdAt" FROM xp_transactions WHERE student_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [me.id],
      ),
    ]);
    return { stats: stats[0] ?? { totalXp: 0, totalStars: 0, levelsCompleted: 0, currentStreak: 0, longestStreak: 0, lastActiveDate: null }, levels, recentXp: xp };
  });

  app.get('/api/me/achievements', student, async (req) => {
    const me = currentUser(req);
    const { rows } = await db.query(
      `SELECT a.id, a.slug, a.name, a.description, a.icon, a.xp_reward AS "xpReward", sa.unlocked_at AS "unlockedAt"
         FROM achievements a LEFT JOIN student_achievements sa ON sa.achievement_id = a.id AND sa.student_id = $1
        WHERE a.deleted_at IS NULL AND a.status = 'PUBLISHED' AND (NOT a.is_secret OR sa.student_id IS NOT NULL)
        ORDER BY a.sort_order, a.name`,
      [me.id],
    );
    return { achievements: rows };
  });

  app.get('/api/me/settings', student, async (req) => {
    const me = currentUser(req);
    await db.query('INSERT INTO student_settings (student_id) VALUES ($1) ON CONFLICT DO NOTHING', [me.id]);
    const { rows } = await db.query(
      `SELECT sound_enabled AS "soundEnabled", volume, music_enabled AS "musicEnabled", reduced_motion AS "reducedMotion", graphics_quality AS "graphicsQuality",
              show_sensor_visualization AS "showSensorVisualization", show_hints AS "showHints", language FROM student_settings WHERE student_id = $1`,
      [me.id],
    );
    return { settings: rows[0] };
  });

  app.put('/api/me/settings', student, async (req) => {
    const me = currentUser(req);
    const s = SettingsBody.parse(req.body);
    await db.query(
      `INSERT INTO student_settings (student_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [me.id],
    );
    await db.query(
      `UPDATE student_settings SET
         sound_enabled = COALESCE($2, sound_enabled), volume = COALESCE($3, volume), music_enabled = COALESCE($4, music_enabled),
         reduced_motion = CASE WHEN $5::boolean THEN $6::boolean ELSE reduced_motion END,
         graphics_quality = COALESCE($7::graphics_quality, graphics_quality),
         show_sensor_visualization = COALESCE($8, show_sensor_visualization), show_hints = COALESCE($9, show_hints), language = COALESCE($10, language)
       WHERE student_id = $1`,
      [me.id, s.soundEnabled ?? null, s.volume ?? null, s.musicEnabled ?? null, 'reducedMotion' in s, s.reducedMotion ?? null, s.graphicsQuality ?? null,
        s.showSensorVisualization ?? null, s.showHints ?? null, s.language ?? null],
    );
    const { rows } = await db.query(
      `SELECT sound_enabled AS "soundEnabled", volume, music_enabled AS "musicEnabled", reduced_motion AS "reducedMotion", graphics_quality AS "graphicsQuality",
              show_sensor_visualization AS "showSensorVisualization", show_hints AS "showHints", language FROM student_settings WHERE student_id = $1`,
      [me.id],
    );
    return { settings: rows[0] };
  });
}
