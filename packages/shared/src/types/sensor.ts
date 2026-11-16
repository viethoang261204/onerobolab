import type { Vec3 } from './geometry';
import type { SensorId } from './ids';

export type SensorKind = 'distance' | 'line' | 'color' | 'touch';

/** Colours the color sensor can classify. Kept small and child-friendly. */
export const SENSOR_COLORS = ['none', 'black', 'white', 'red', 'green', 'blue', 'yellow'] as const;
export type SensorColor = (typeof SENSOR_COLORS)[number];

interface SensorMountBase {
  readonly id: SensorId;
  readonly label: string;
  /** Offset from the robot origin in robot-local space (+X forward, +Y up, +Z right). */
  readonly offset: Vec3;
}

export interface DistanceSensorMount extends SensorMountBase {
  readonly kind: 'distance';
  /** Yaw of the beam relative to robot forward (rad). */
  readonly yaw: number;
  readonly maxRange: number;
}

export interface LineSensorMount extends SensorMountBase {
  readonly kind: 'line';
}

export interface ColorSensorMount extends SensorMountBase {
  readonly kind: 'color';
}

export interface TouchSensorMount extends SensorMountBase {
  readonly kind: 'touch';
  /** Size of the bumper trigger volume (m). */
  readonly size: Vec3;
}

export type SensorMount =
  | DistanceSensorMount
  | LineSensorMount
  | ColorSensorMount
  | TouchSensorMount;

export type SensorReading =
  /** `distance` is null when nothing is within range. */
  | { readonly kind: 'distance'; readonly distance: number | null }
  /**
   * `intensity` 0 (bare floor) … 1 (fully on the line). `offset` is the
   * signed sideways distance to the nearest line (m, + = line is to the
   * robot's left), or null when no line is within LINE_SEARCH_RADIUS.
   */
  | { readonly kind: 'line'; readonly onLine: boolean; readonly intensity: number; readonly offset: number | null }
  | { readonly kind: 'color'; readonly color: SensorColor }
  | { readonly kind: 'touch'; readonly pressed: boolean };

/** All sensor readings for one simulation tick, keyed by sensor id. */
export type SensorSnapshot = Readonly<Partial<Record<SensorId, SensorReading>>>;

/** "Obstacle ahead" threshold for the distance sensor (m). */
export const OBSTACLE_DISTANCE = 0.2;
/** How far sideways the line sensor looks for a line to report an offset (m). */
export const LINE_SEARCH_RADIUS = 0.15;
