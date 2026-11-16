/** Per-mission scoring configuration. All point values are non-negative. */
export interface ScoringRules {
  /** Awarded when the mission succeeds. */
  readonly completionPoints: number;
  /** Awarded per checkpoint visited (even on failure). */
  readonly checkpointPoints: number;
  /** Bonus that decays linearly from `maxPoints` at 0 s to 0 at `parSeconds * 2`. */
  readonly timeBonus: { readonly parSeconds: number; readonly maxPoints: number } | null;
  /** Bonus for solving with at most `parBlocks` blocks. */
  readonly efficiencyBonus: { readonly parBlocks: number; readonly maxPoints: number } | null;
  /** Deducted per collision. */
  readonly collisionPenalty: number;
  /** Awarded per completed bonus (optional) objective, success or not. */
  readonly bonusPoints?: number;
}

/** Facts about a finished run that scoring needs beyond mission state. */
export interface RunStats {
  readonly elapsed: number;
  readonly collisions: number;
  readonly blockCount: number;
  readonly distanceTravelled: number;
}

export type ScoreItemKey = 'completion' | 'checkpoints' | 'bonus' | 'time' | 'efficiency' | 'collisions';

export interface ScoreItem {
  readonly key: ScoreItemKey;
  readonly label: string;
  /** Signed contribution (penalties are negative). */
  readonly points: number;
  /** Maximum achievable for this item (0 for penalties). */
  readonly maxPoints: number;
}

export interface ScoreBreakdown {
  /** Clamped to [0, max]. */
  readonly total: number;
  readonly max: number;
  /** 0–3 stars for kid-friendly feedback. */
  readonly stars: 0 | 1 | 2 | 3;
  readonly items: readonly ScoreItem[];
}
