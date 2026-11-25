import type { RobotVisualState, RobotVisualStatus } from './RobotTypes';

/*
 * Pure animation curves (no three.js, testable). `Robot.tsx` applies them to
 * refs inside one `useFrame`. All motion is deliberately subtle.
 */

const DEG = Math.PI / 180;

/** Body bob (design units): gentle breathing when idle, a small happy hop on success. */
export function bodyBob(status: RobotVisualStatus, t: number): number {
  if (status === 'idle') return Math.sin(t * 2.1) * 0.0035;
  if (status === 'success') return Math.abs(Math.sin(t * 5.5)) * 0.022;
  return 0;
}

/** Head yaw target (rad): idle scan ±3°, running looks into turns. */
export function headYawTarget(state: RobotVisualState, t: number): number {
  switch (state.status) {
    case 'idle':
      return Math.sin(t * 0.55) * 3 * DEG;
    case 'running':
      return Math.max(-14 * DEG, Math.min(14 * DEG, state.angular * 0.28));
    case 'success':
      return Math.sin(t * 2.4) * 6 * DEG;
    case 'error':
      // small "no" shake that settles into a slight tilt
      return Math.sin(t * 9) * 5 * DEG * Math.max(0.25, Math.cos(t * 0.8) ** 2);
    default:
      return 0;
  }
}

/** Head pitch target (rad, + = look down). */
export function headPitchTarget(state: RobotVisualState, t: number): number {
  switch (state.status) {
    case 'running':
      return 7 * DEG; // watch the track ahead
    case 'idle':
      return 2 * DEG + Math.sin(t * 0.4) * 1.5 * DEG;
    case 'stopped':
      return 10 * DEG;
    case 'error':
      return 16 * DEG; // looks down at what it hit
    default:
      return 0;
  }
}

export interface DisplayFrame {
  /** Hex colour of eyes / LEDs. */
  readonly color: string;
  /** Emissive intensity of the eyes. */
  readonly eyeIntensity: number;
  /** Horizontal eye shift (-1…1, fraction of travel). */
  readonly eyeShift: number;
  /** Vertical eye scale (blink / squash). */
  readonly eyeScaleY: number;
  /** Front LED bar intensity. */
  readonly ledIntensity: number;
}

const CYAN = '#12A6A1';
const GREEN = '#FFC857';
const RED = '#F26B5B';

/** LED status display pattern for a status at time t. */
export function displayFrame(status: RobotVisualStatus, t: number): DisplayFrame {
  switch (status) {
    case 'idle': {
      // gentle pulse + a quick blink every ~4 s
      const blink = t % 4.2 < 0.12 ? 0.15 : 1;
      return { color: CYAN, eyeIntensity: 1.25 + Math.sin(t * 1.8) * 0.16, eyeShift: 0, eyeScaleY: blink, ledIntensity: 0.85 + Math.sin(t * 1.8) * 0.15 };
    }
    case 'running':
      // scanning: eyes sweep side to side
      return { color: CYAN, eyeIntensity: 1.7, eyeShift: Math.sin(t * 3.2), eyeScaleY: 1, ledIntensity: 1.5 };
    case 'success': {
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      return { color: GREEN, eyeIntensity: 1.35 + pulse * 0.55, eyeShift: 0, eyeScaleY: 1 + pulse * 0.16, ledIntensity: 1.1 + pulse * 0.45 };
    }
    case 'error': {
      const flash = Math.sin(t * 9) > 0 ? 1 : 0.25;
      return { color: RED, eyeIntensity: 1.5 * flash, eyeShift: 0, eyeScaleY: 0.42, ledIntensity: 1.4 * flash };
    }
    case 'stopped':
      return { color: CYAN, eyeIntensity: 0.55, eyeShift: 0, eyeScaleY: 0.58, ledIntensity: 0.3 };
  }
}
