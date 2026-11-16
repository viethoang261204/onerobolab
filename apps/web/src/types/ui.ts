import type { LucideIcon } from 'lucide-react';

export type NavId = 'home' | 'explore' | 'simulator' | 'robots' | 'learn';

export interface NavItem {
  readonly id: NavId;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Not available yet: rendered disabled with a "coming soon" tooltip. */
  readonly soon?: boolean;
}

export type CodeTab = 'blocks' | 'split' | 'python';
export type OutputTab = 'console' | 'variables';

/** Camera presets: `chase` (behind the robot, default), `overview` (whole course), `top`. */
export type CameraView = 'chase' | 'overview' | 'top';

export type SimStatus = 'idle' | 'running' | 'stopped' | 'finished' | 'error';

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface ConsoleEntry {
  readonly id: number;
  readonly level: LogLevel;
  readonly message: string;
  /** Wall-clock time the entry was logged (UI only; never used by the simulation). */
  readonly at: number;
}

export type RobotGlyphKind = 'rover' | 'excavator' | 'tank' | 'scout' | 'arm' | 'drone';

export interface RobotOption {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly glyph: RobotGlyphKind;
  /** Robot definition in the robot catalogue, when the model is available. */
  readonly definitionId: string | null;
}

export type ObjectiveState = 'done' | 'active' | 'pending' | 'failed';

export interface MissionObjectiveView {
  readonly id: string;
  readonly label: string;
  readonly state: ObjectiveState;
  /** Counter for counting objectives ("2/3"). */
  readonly progress?: string;
  /** Bonus objective (not needed to pass). */
  readonly bonus?: boolean;
}

export interface MissionView {
  readonly title: string;
  readonly objectives: readonly MissionObjectiveView[];
  readonly outcome: 'success' | 'failure' | null;
}

export interface UserProfile {
  readonly name: string;
  readonly level: number;
  /** 0–1 progress to the next level. */
  readonly xpProgress: number;
}
