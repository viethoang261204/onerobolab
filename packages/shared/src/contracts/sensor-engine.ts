import type { Pose2D } from '../types/geometry';
import type { SensorMount, SensorSnapshot } from '../types/sensor';
import type { MapQuery } from './map-engine';
import type { PhysicsQuery } from './physics-engine';

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
