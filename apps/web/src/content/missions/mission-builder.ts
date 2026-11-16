import { entityId, missionId, robotId, type MapDefinition, type MissionDefinition, type Objective, type ScoringRules } from '@robolab/shared';

export interface MissionOptions {
  readonly title: string;
  readonly description: string;
  readonly failOnCollision?: boolean;
  readonly timeLimit?: number | null;
  /** Wording per checkpoint (in order), e.g. "Cross the bridge". */
  readonly checkpointLabels?: readonly string[];
  /** Wording for the goal objective. */
  readonly goalLabel?: string;
  /** The goal only counts once the robot stops inside it. */
  readonly stopInFinish?: boolean;
  /** Score bonuses (time / efficiency) — usually from the level's star targets via `scoringFor`. */
  readonly scoring?: ScoringRules;
  /** Extra task objectives (crates pushed, cargo delivered…), listed before the goal. */
  readonly tasks?: readonly Objective[];
  /** Bonus objectives (`optional`), listed last. */
  readonly bonus?: readonly Objective[];
  /** Checkpoints must be reached in order (driving into a later one first fails). */
  readonly orderedCheckpoints?: boolean;
  /**
   * `each` (default): one objective per checkpoint. `all`: a single
   * “visit every checkpoint” objective — for levels whose layouts (variants)
   * move, add or remove checkpoints.
   */
  readonly checkpoints?: 'each' | 'all';
  /** Label of the `all` checkpoint objective. */
  readonly allCheckpointsLabel?: string;
  /** No “reach the goal” objective (the tasks are the mission). */
  readonly noGoal?: boolean;
}

/**
 * Scoring rules from a level's star targets: 500 for completing, 100 per
 * checkpoint, up to 200 for finishing within par time, up to 200 for using
 * at most par blocks, −100 per collision.
 */
export function scoringFor(stars: { readonly parBlocks?: number; readonly parSeconds?: number }, bonusPoints?: number): ScoringRules {
  return {
    ...(bonusPoints && { bonusPoints }),
    completionPoints: 500,
    checkpointPoints: 100,
    timeBonus: stars.parSeconds ? { parSeconds: stars.parSeconds, maxPoints: 200 } : null,
    efficiencyBonus: stars.parBlocks ? { parBlocks: stars.parBlocks, maxPoints: 200 } : null,
    collisionPenalty: 100,
  };
}

/**
 * Standard mission for a level world: visit each checkpoint, reach the goal,
 * don't crash. Levels can also hand-write a MissionDefinition.
 */
export function standardMission(levelId: string, map: MapDefinition, opts: MissionOptions): MissionDefinition {
  // Checkpoints that are bonus objectives aren't required ones too.
  const bonusCps = new Set((opts.bonus ?? []).flatMap((o) => (o.type === 'reachCheckpoint' ? [String(o.checkpointId)] : [])));
  const checkpoints = map.entities.filter((e) => e.type === 'checkpoint' && !bonusCps.has(String(e.id))).sort((a, b) => (a.type === 'checkpoint' && b.type === 'checkpoint' ? a.order - b.order : 0));
  const cpObjectives: Objective[] =
    opts.checkpoints === 'all'
      ? checkpoints.length
        ? [{ id: 'all-cp', type: 'reachAllCheckpoints', ordered: !!opts.orderedCheckpoints, ...(opts.allCheckpointsLabel && { label: opts.allCheckpointsLabel }) }]
        : []
      : checkpoints.map((c, i) => {
          const label = opts.checkpointLabels?.[i];
          return { id: String(c.id), type: 'reachCheckpoint' as const, checkpointId: entityId(String(c.id)), ...(label && { label }) };
        });
  const objectives: Objective[] = [
    ...cpObjectives,
    ...(opts.tasks ?? []),
    ...(opts.noGoal ? [] : [{ id: 'goal', type: 'reachFinish' as const, ...(opts.goalLabel && { label: opts.goalLabel }) }]),
    { id: 'safe', type: 'avoidCollisions', maxCollisions: 0 },
    ...(opts.bonus ?? []).map((o) => ({ ...o, optional: true })),
  ];
  return {
    id: missionId(`mission-${levelId}`),
    title: opts.title,
    description: opts.description,
    mapId: map.id,
    robotId: robotId('rover'),
    objectives,
    timeLimit: opts.timeLimit ?? null,
    failOnCollision: opts.failOnCollision ?? true,
    scoring: opts.scoring ?? { completionPoints: 500, checkpointPoints: 100, timeBonus: null, efficiencyBonus: null, collisionPenalty: 100 },
    ...(opts.stopInFinish && { stopInFinish: true }),
    ...(opts.orderedCheckpoints && { orderedCheckpoints: true }),
  };
}
