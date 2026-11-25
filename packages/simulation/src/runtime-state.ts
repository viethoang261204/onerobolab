import type { MissionState, Pose2D, RuntimeValue, SensorColor } from '@robolab/shared';
import type { ExecutionMode } from './runtime-events.ts';

/** Lifecycle of one run. */
export type RunState = 'idle' | 'running' | 'paused' | 'stopped' | 'finished' | 'success' | 'error';

/** Human-level sensor values (what the Variables tab and blocks talk about). */
export interface SensorSummary {
  /** Metres to the nearest obstacle ahead, null when nothing is in range. */
  readonly distance: number | null;
  readonly line: boolean;
  /** Metres, + = line is to the robot's left; null when no line nearby. */
  readonly lineOffset: number | null;
  readonly obstacle: boolean;
  readonly color: SensorColor;
  readonly touch: boolean;
}

export const EMPTY_SENSORS: SensorSummary = { distance: null, line: false, lineOffset: null, obstacle: false, color: 'none', touch: false };

/** Throttled picture of the runtime for the UI (never per frame through React). */
export interface RuntimeSnapshot {
  readonly runState: RunState;
  readonly mode: ExecutionMode;
  readonly time: number;
  readonly activeBlockId: string | null;
  readonly errorBlockId: string | null;
  readonly variables: Readonly<Record<string, RuntimeValue>>;
  readonly sensors: SensorSummary;
  readonly mission: MissionState | null;
  readonly pose: Pose2D;
  /** Program speed (0–1). */
  readonly speed: number;
}
