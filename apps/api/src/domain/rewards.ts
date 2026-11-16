import type { Queryable } from '../db/db.ts';

/** Practice streak: consecutive days with at least one run (server date). */
export async function touchStreak(q: Queryable, studentId: string): Promise<void> {
  await q.query(
    `INSERT INTO student_stats (student_id, current_streak, longest_streak, last_active_date)
     VALUES ($1, 1, 1, CURRENT_DATE)
     ON CONFLICT (student_id) DO UPDATE SET
       current_streak = CASE
         WHEN student_stats.last_active_date = CURRENT_DATE THEN student_stats.current_streak
         WHEN student_stats.last_active_date = CURRENT_DATE - 1 THEN student_stats.current_streak + 1
         ELSE 1 END,
       longest_streak = GREATEST(student_stats.longest_streak, CASE
         WHEN student_stats.last_active_date = CURRENT_DATE THEN student_stats.current_streak
         WHEN student_stats.last_active_date = CURRENT_DATE - 1 THEN student_stats.current_streak + 1
         ELSE 1 END),
       last_active_date = CURRENT_DATE`,
    [studentId],
  );
}

interface Criteria {
  type: string;
  count?: number;
  level?: string;
  world?: string;
  block?: string;
}

/**
 * Evaluates every published achievement the student doesn't have yet and
 * awards the ones now met (plus their XP, once). Runs inside the submission
 * transaction. Returns the slugs unlocked.
 */
export async function evaluateAchievements(q: Queryable, studentId: string, context: { usedBlockTypes: ReadonlySet<string> }): Promise<string[]> {
  const { rows: candidates } = await q.query<{ id: string; slug: string; name: string; xp_reward: number; criteria: Criteria }>(
    `SELECT a.id, a.slug, a.name, a.xp_reward, a.criteria FROM achievements a
      WHERE a.status = 'PUBLISHED' AND a.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM student_achievements s WHERE s.student_id = $1 AND s.achievement_id = a.id)`,
    [studentId],
  );
  if (!candidates.length) return [];
  const { rows: facts } = await q.query<{ completed: string[]; three_star: number; total_stars: number; streak: number }>(
    `SELECT COALESCE(array_agg(l.slug) FILTER (WHERE p.status = 'COMPLETED'), '{}') AS completed,
            COUNT(*) FILTER (WHERE p.status = 'COMPLETED' AND p.best_stars >= 3)::int AS three_star,
            COALESCE((SELECT total_stars FROM student_stats WHERE student_id = $1), 0) AS total_stars,
            COALESCE((SELECT current_streak FROM student_stats WHERE student_id = $1), 0) AS streak
       FROM student_level_progress p JOIN levels l ON l.id = p.level_id
      WHERE p.student_id = $1`,
    [studentId],
  );
  const f = facts[0] ?? { completed: [], three_star: 0, total_stars: 0, streak: 0 };
  const completed = new Set(f.completed);
  const { rows: worlds } = await q.query<{ slug: string }>(
    `SELECT w.slug FROM worlds w
      WHERE w.deleted_at IS NULL AND EXISTS (SELECT 1 FROM levels l WHERE l.world_id = w.id AND l.status = 'PUBLISHED' AND l.deleted_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM levels l WHERE l.world_id = w.id AND l.status = 'PUBLISHED' AND l.deleted_at IS NULL
                          AND NOT EXISTS (SELECT 1 FROM student_level_progress p WHERE p.level_id = l.id AND p.student_id = $1 AND p.status = 'COMPLETED'))`,
    [studentId],
  );
  const completedWorlds = new Set(worlds.map((w) => w.slug));

  const met = (c: Criteria): boolean => {
    switch (c.type) {
      case 'complete_levels':
        return completed.size >= (c.count ?? 1);
      case 'complete_level':
        return !!c.level && completed.has(c.level);
      case 'complete_world':
        return !!c.world && completedWorlds.has(c.world);
      case 'total_stars':
        return f.total_stars >= (c.count ?? 0);
      case 'three_star_levels':
        return f.three_star >= (c.count ?? 1);
      case 'streak_days':
        return f.streak >= (c.count ?? 1);
      case 'use_block':
        return !!c.block && context.usedBlockTypes.has(c.block);
      default:
        return false; // unknown rule types never fire
    }
  };

  const unlocked: string[] = [];
  for (const a of candidates) {
    if (!met(a.criteria)) continue;
    const { rowCount } = await q.query('INSERT INTO student_achievements (student_id, achievement_id, context) VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING', [
      studentId,
      a.id,
      JSON.stringify({ source: 'submission' }),
    ]);
    if (!rowCount) continue;
    if (a.xp_reward > 0) {
      await q.query(
        `INSERT INTO xp_transactions (student_id, amount, source_type, source_id, description) VALUES ($1, $2, 'ACHIEVEMENT', $3, $4)
         ON CONFLICT DO NOTHING`,
        [studentId, a.xp_reward, a.id, `Achievement unlocked: ${a.name}`],
      );
    }
    unlocked.push(a.slug);
  }
  return unlocked;
}
