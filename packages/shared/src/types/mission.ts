import type { EntityId, MapId, MissionId, RobotId } from './ids.ts';
import type { ScoringRules } from './scoring.ts';

interface ObjectiveBase {
  /** Unique within the mission. */
  readonly id: string;
  /** Student-facing wording ("Cross the bridge"); the UI derives one when omitted. */
  readonly label?: string;
  /**
   * Bonus objective: not needed to pass, earns `ScoringRules.bonusPoints`
   * when completed (Island Recovery, Arena).
   */
  readonly optional?: boolean;
}

/** A single goal inside a mission. */
export type Objective =
  | (ObjectiveBase & { readonly type: 'reachCheckpoint'; readonly checkpointId: EntityId })
  | (ObjectiveBase & { readonly type: 'reachAllCheckpoints'; readonly ordered: boolean })
  | (ObjectiveBase & { readonly type: 'reachFinish' })
  | (ObjectiveBase & { readonly type: 'avoidCollisions'; readonly maxCollisions: number })
  | (ObjectiveBase & { readonly type: 'finishWithin'; readonly seconds: number })
  /** Push `count` pushable crates (dynamic boxes) into the construction zone `zoneId`. */
  | (ObjectiveBase & { readonly type: 'pushToZone'; readonly zoneId: EntityId; readonly count: number })
  /** Deliver `count` crates into delivery zones (only into `zoneId` when given); 0 = every crate on the map. */
  | (ObjectiveBase & { readonly type: 'deliverCargo'; readonly count: number; readonly zoneId?: EntityId });

export type ObjectiveType = Objective['type'];

export interface MissionDefinition {
  readonly id: MissionId;
  readonly title: string;
  readonly description: string;
  readonly mapId: MapId;
  readonly robotId: RobotId;
  readonly objectives: readonly Objective[];
  /** Hard time limit in simulation seconds; null = unlimited. */
  readonly timeLimit: number | null;
  /** When true, the first collision with a wall/obstacle fails the mission. */
  readonly failOnCollision: boolean;
  readonly scoring: ScoringRules;
  /**
   * `reachFinish` only completes once the robot has come to rest inside the
   * finish area ("stop in the delivery zone"), not just by driving through it.
   */
  readonly stopInFinish?: boolean;
  /**
   * Checkpoints must be visited in their `order`: driving into a later one
   * first fails the mission (Rescue Route).
   */
  readonly orderedCheckpoints?: boolean;
}

export type MissionStatus = 'notStarted' | 'running' | 'success' | 'failure';

export type MissionFailureReason =
  | 'collision'
  | 'timeout'
  | 'outOfBounds'
  | 'programEnded'
  /** Drove into a hazard zone. */
  | 'hazard'
  /** Entered a crossing while its light was red. */
  | 'redLight'
  /** Dropped a crate outside a delivery zone or in the wrong colour's zone. */
  | 'wrongDelivery'
  /** Reached a checkpoint before the one that comes first. */
  | 'wrongOrder';

export interface ObjectiveProgress {
  readonly objectiveId: string;
  readonly completed: boolean;
  /** Simulation time (s) at completion, null while incomplete. */
  readonly completedAt: number | null;
  /** Counter for objectives with a target number ("2 / 3 crates"). */
  readonly progress?: { readonly done: number; readonly total: number };
  /** Bonus objective (not needed to pass). */
  readonly optional?: boolean;
}

/** Mission state. Owned by the Mission Engine, derived from simulation snapshots. */
export interface MissionState {
  readonly missionId: MissionId;
  readonly status: MissionStatus;
  readonly elapsed: number;
  readonly objectives: readonly ObjectiveProgress[];
  readonly visitedCheckpoints: readonly EntityId[];
  readonly collisionCount: number;
  readonly failureReason: MissionFailureReason | null;
}
