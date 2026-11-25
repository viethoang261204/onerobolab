import type { Pose2D } from '../types/geometry.ts';
import type { SensorMount, SensorSnapshot } from '../types/sensor.ts';
import type { MapQuery } from './map-engine.ts';
import type { PhysicsQuery } from './physics-engine.ts';

/** World access granted to sensors: read-only physics and map queries. */
export interface SensorWorld {
  readonly physics: PhysicsQuery;
  readonly map: MapQuery;
}

/** Sensor Engine: turns robot pose + world into readings. Stateless per tick. */
export interface SensorEngine {
  configure(mounts: readonly SensorMount[]): void;
  sample(pose: Pose2D, world: SensorWorld): SensorSnapshot;
}
