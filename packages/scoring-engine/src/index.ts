/**
 * @robolab/scoring-engine — pure function from (rules, mission state, run
 * stats) to a score breakdown, plus the rank a score earns.
 *
 * The same formula runs on the server (`apps/api/src/domain/scoring.ts`),
 * which is authoritative for stars and XP; the browser uses this package for
 * the live HUD and the result breakdown. Keep the two in step (both test the
 * same fixtures).
 */
import type { MissionState, ScoreBreakdown, ScoreInput, ScoreItem, ScoringEngine, ScoringRules } from '@robolab/shared';

export type { ScoreInput, ScoringEngine } from '@robolab/shared';

/** Ranks by share of the maximum score (successful runs only). */
export type Rank = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

/** Default rules: 500 for completing, 100 per checkpoint, −100 per collision. */
export const DEFAULT_SCORING: ScoringRules = { completionPoints: 500, checkpointPoints: 100, timeBonus: null, efficiencyBonus: null, collisionPenalty: 100 };

/** Linear time bonus: full at ≤ par seconds, falling to 0 at 2 × par. */
export function timeBonus(rules: ScoringRules, elapsed: number): number {
  const b = rules.timeBonus;
  if (!b || b.parSeconds <= 0) return 0;
  const k = elapsed <= b.parSeconds ? 1 : Math.max(0, 1 - (elapsed - b.parSeconds) / b.parSeconds);
  return Math.round(b.maxPoints * k);
}

/** Efficiency bonus: full at ≤ par blocks, minus 20 % per extra block. */
export function efficiencyBonus(rules: ScoringRules, blockCount: number): number {
  const b = rules.efficiencyBonus;
  if (!b || blockCount <= 0) return 0;
  const k = blockCount <= b.parBlocks ? 1 : Math.max(0, 1 - 0.2 * (blockCount - b.parBlocks));
  return Math.round(b.maxPoints * k);
}

/** Highest possible total for a mission with these rules, checkpoints and bonus objectives. */
export function maxScore(rules: ScoringRules, checkpoints: number, bonusObjectives = 0): number {
  return rules.completionPoints + rules.checkpointPoints * checkpoints + (rules.bonusPoints ?? 0) * bonusObjectives + (rules.timeBonus?.maxPoints ?? 0) + (rules.efficiencyBonus?.maxPoints ?? 0);
}

/**
 * Score a run. Bonuses (time, efficiency) are only paid on success; points
 * for checkpoints count even when the run fails, so partial progress shows.
 */
export function scoreRun({ rules, mission, stats }: ScoreInput): ScoreBreakdown {
  const success = mission.status === 'success';
  const cps = mission.objectives.filter(isCheckpoint);
  const items: ScoreItem[] = [
    { key: 'completion', label: 'Mission complete', points: success ? rules.completionPoints : 0, maxPoints: rules.completionPoints },
    { key: 'checkpoints', label: 'Checkpoints', points: cps.filter((o) => o.completed).length * rules.checkpointPoints, maxPoints: cps.length * rules.checkpointPoints },
  ];
  const bonus = mission.objectives.filter((o) => o.optional);
  if (bonus.length > 0 && rules.bonusPoints) items.push({ key: 'bonus', label: 'Bonus objectives', points: bonus.filter((o) => o.completed).length * rules.bonusPoints, maxPoints: bonus.length * rules.bonusPoints });
  if (rules.timeBonus) items.push({ key: 'time', label: 'Time bonus', points: success ? timeBonus(rules, stats.elapsed) : 0, maxPoints: rules.timeBonus.maxPoints });
  if (rules.efficiencyBonus) items.push({ key: 'efficiency', label: 'Efficient code', points: success ? efficiencyBonus(rules, stats.blockCount) : 0, maxPoints: rules.efficiencyBonus.maxPoints });
  if (stats.collisions > 0 && rules.collisionPenalty > 0) items.push({ key: 'collisions', label: 'Collisions', points: -stats.collisions * rules.collisionPenalty, maxPoints: 0 });
  const max = items.reduce((s, i) => s + i.maxPoints, 0);
  const total = Math.max(0, Math.min(max, items.reduce((s, i) => s + i.points, 0)));
  const share = max > 0 ? total / max : 0;
  const stars = !success ? 0 : share >= 0.9 ? 3 : share >= 0.7 ? 2 : 1;
  return { total, max, stars, items };
}

/** Checkpoint objectives ("cp-1"…); points are paid per completed one (the server counts the same). */
const isCheckpoint = (o: MissionState['objectives'][number]) => o.objectiveId.startsWith('cp-') && !o.optional;

/** Rank for a score: Platinum ≥ 95 %, Gold ≥ 80 %, Silver ≥ 60 %, Bronze for any success. */
export function rankOf(total: number, max: number, success: boolean): Rank {
  if (!success || max <= 0) return 'none';
  const s = total / max;
  return s >= 0.95 ? 'platinum' : s >= 0.8 ? 'gold' : s >= 0.6 ? 'silver' : 'bronze';
}

/** The engine object (contract in `@robolab/shared`). */
export const scoringEngine: ScoringEngine = { score: scoreRun };
