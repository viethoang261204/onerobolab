import { z } from 'zod';
import { unprocessable } from '../http/errors.ts';

/*
 * Server-side scoring. The client reports what happened in the simulator
 * (objectives reached, simulated time, collisions); the server decides
 * pass / fail, stars, score and XP from the level's rules and the program it
 * has stored — clients never send stars, score or XP.
 */

/** Rover's top linear speed (m/s): wheels at maxWheelSpeed. */
export const MAX_ROBOT_SPEED = 0.5;
/** Timing slack for the plausibility check (simulation steps, turns are extra). */
const TIME_TOLERANCE = 0.9;

export const RunReportSchema = z
  .object({
    /** Objective codes the mission tracker completed ("cp-1", "goal", …). */
    objectivesCompleted: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/)).max(50),
    /** Simulated seconds from Run to the end of the run. */
    timeSeconds: z.number().finite().min(0).max(3600),
    collisions: z.number().int().min(0).max(1000),
    errorMessage: z.string().max(500).optional(),
  })
  .strict();
export type RunReport = z.infer<typeof RunReportSchema>;

export interface ObjectiveRule {
  readonly code: string;
  readonly type: string;
  readonly required: boolean;
  readonly config: Record<string, unknown>;
  /** Checkpoint centre for REACH_CHECKPOINT objectives. */
  readonly position: { x: number; z: number } | null;
}

/** Point rules (same shape and formula as `@robolab/scoring-engine`). */
export interface PointRules {
  readonly completionPoints: number;
  readonly checkpointPoints: number;
  readonly timeBonus: { readonly parSeconds: number; readonly maxPoints: number } | null;
  readonly efficiencyBonus: { readonly parBlocks: number; readonly maxPoints: number } | null;
  readonly collisionPenalty: number;
  /** Per completed bonus (optional) objective. */
  readonly bonusPoints?: number;
}

export const DEFAULT_POINTS: PointRules = { completionPoints: 500, checkpointPoints: 100, timeBonus: null, efficiencyBonus: null, collisionPenalty: 100 };

/**
 * Points for a run — mirrors `scoreRun` in packages/scoring-engine (the
 * browser shows the same numbers; both are tested on the same cases).
 * Bonuses only on a pass; checkpoints count even on a failed run.
 */
export function pointsFor(
  p: PointRules,
  run: { passed: boolean; checkpoints: number; totalCheckpoints: number; timeSeconds: number; blockCount: number; collisions: number; bonus?: number; totalBonus?: number },
): number {
  const time = !run.passed || !p.timeBonus || p.timeBonus.parSeconds <= 0 ? 0 : Math.round(p.timeBonus.maxPoints * (run.timeSeconds <= p.timeBonus.parSeconds ? 1 : Math.max(0, 1 - (run.timeSeconds - p.timeBonus.parSeconds) / p.timeBonus.parSeconds)));
  const eff = !run.passed || !p.efficiencyBonus || run.blockCount <= 0 ? 0 : Math.round(p.efficiencyBonus.maxPoints * (run.blockCount <= p.efficiencyBonus.parBlocks ? 1 : Math.max(0, 1 - 0.2 * (run.blockCount - p.efficiencyBonus.parBlocks))));
  const bonusPoints = p.bonusPoints ?? 0;
  const max = p.completionPoints + p.checkpointPoints * run.totalCheckpoints + bonusPoints * (run.totalBonus ?? 0) + (p.timeBonus?.maxPoints ?? 0) + (p.efficiencyBonus?.maxPoints ?? 0);
  const total = (run.passed ? p.completionPoints : 0) + run.checkpoints * p.checkpointPoints + bonusPoints * (run.bonus ?? 0) + time + eff - run.collisions * p.collisionPenalty;
  return Math.max(0, Math.min(max, total));
}

export interface LevelRules {
  readonly parBlocks: number | null;
  readonly parSeconds: number | null;
  readonly maxStars: number;
  readonly failOnCollision: boolean;
  readonly timeLimit: number | null;
  readonly start: { x: number; z: number } | null;
  readonly finish: { x: number; z: number } | null;
  readonly objectives: readonly ObjectiveRule[];
  /** Point rules from `mission_settings.scoring` (defaults when absent). */
  readonly points?: PointRules;
}

export interface Scored {
  readonly passed: boolean;
  readonly stars: number;
  readonly score: number;
  readonly criteria: readonly { id: string; label: string; met: boolean }[];
  readonly reasons: readonly string[];
  readonly objectives: readonly { code: string; completed: boolean }[];
}

/**
 * Validates a run report against the level and computes the result.
 * Throws 422 IMPLAUSIBLE_RESULT for reports that could not have happened.
 */
export function scoreRun(rules: LevelRules, report: RunReport, blockCount: number): Scored {
  const known = new Set(rules.objectives.map((o) => o.code));
  const unknown = report.objectivesCompleted.filter((c) => !known.has(c));
  if (unknown.length) throw unprocessable('IMPLAUSIBLE_RESULT', 'The result mentions objectives this level does not have.', { objectives: unknown });

  const claimed = new Set(report.objectivesCompleted);
  const reasons: string[] = [];
  const objectives = rules.objectives.map((o) => {
    // Collision / time rules are judged by the server, not by the claim.
    let completed = claimed.has(o.code);
    if (o.type === 'AVOID_COLLISIONS') completed = report.collisions <= Number(o.config.maxCollisions ?? 0);
    if (o.type === 'FINISH_WITHIN') completed = claimed.has(o.code) && report.timeSeconds <= Number(o.config.seconds ?? Infinity);
    // A reported run means the program started; the block limit uses the server's own count.
    if (o.type === 'START_PROGRAM') completed = true;
    if (o.type === 'USE_MAX_BLOCKS') completed = blockCount <= Number(o.config.count ?? Infinity);
    // CUSTOM objectives are judged by the simulator's mission engine when they describe a tracked
    // objective (`config.tracked`, e.g. crates in a zone); otherwise they are shown only, never block a pass.
    return { code: o.code, completed, required: o.required && (o.type !== 'CUSTOM' || o.config.tracked === true), bonus: !o.required };
  });

  // Physical lower bound on time: straight lines start → claimed checkpoints → goal at top speed.
  const route: { x: number; z: number }[] = [];
  if (rules.start) route.push(rules.start);
  for (const o of rules.objectives) if (o.type === 'REACH_CHECKPOINT' && o.position && claimed.has(o.code)) route.push(o.position);
  const goalClaimed = rules.objectives.some((o) => o.type === 'REACH_GOAL' && claimed.has(o.code));
  if (goalClaimed && rules.finish) route.push(rules.finish);
  let distance = 0;
  for (let i = 1; i < route.length; i++) distance += Math.hypot(route[i]!.x - route[i - 1]!.x, route[i]!.z - route[i - 1]!.z);
  // The goal counts once the robot enters it; allow ~0.4 m for goal size and robot length.
  const minTime = Math.max(0, distance - 0.4) / MAX_ROBOT_SPEED;
  if (report.timeSeconds < minTime * TIME_TOLERANCE) {
    throw unprocessable('IMPLAUSIBLE_RESULT', 'The reported time is faster than the robot can drive this route.', { minimumSeconds: Math.round(minTime * 10) / 10 });
  }

  const missing = objectives.filter((o) => o.required && !o.completed).map((o) => o.code);
  if (missing.length) reasons.push(`Objectives not completed: ${missing.join(', ')}`);
  if (rules.failOnCollision && report.collisions > 0) reasons.push('The robot collided with something.');
  if (rules.timeLimit !== null && report.timeSeconds > rules.timeLimit) reasons.push('Time limit exceeded.');
  const passed = reasons.length === 0;

  const criteria = [
    { id: 'complete', label: 'Mission complete', met: passed },
    { id: 'efficient', label: rules.parBlocks !== null ? `${rules.parBlocks} blocks or fewer` : 'Efficient program', met: passed && (rules.parBlocks === null || blockCount <= rules.parBlocks) },
    { id: 'fast', label: rules.parSeconds !== null ? `Finish within ${rules.parSeconds} s` : 'Quick finish', met: passed && (rules.parSeconds === null || report.timeSeconds <= rules.parSeconds) },
  ];
  const stars = passed ? Math.min(rules.maxStars, criteria.filter((c) => c.met).length) : 0;
  const checkpoints = rules.objectives.filter((o) => o.type === 'REACH_CHECKPOINT' && o.required);
  const bonus = objectives.filter((o) => o.bonus);
  const score = pointsFor(rules.points ?? DEFAULT_POINTS, {
    passed,
    checkpoints: checkpoints.filter((o) => objectives.find((x) => x.code === o.code)?.completed).length,
    totalCheckpoints: checkpoints.length,
    timeSeconds: report.timeSeconds,
    blockCount,
    collisions: report.collisions,
    bonus: bonus.filter((o) => o.completed).length,
    totalBonus: bonus.length,
  });
  return { passed, stars, score, criteria, reasons, objectives: objectives.map(({ code, completed }) => ({ code, completed })) };
}
