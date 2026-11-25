import type { MissionState } from '../types/mission.ts';
import type { RunStats, ScoreBreakdown, ScoringRules } from '../types/scoring.ts';

export interface ScoreInput {
  readonly rules: ScoringRules;
  readonly mission: MissionState;
  readonly stats: RunStats;
}

/** Scoring Engine: a pure function of its input. No state, no side effects. */
export interface ScoringEngine {
  score(input: ScoreInput): ScoreBreakdown;
}
