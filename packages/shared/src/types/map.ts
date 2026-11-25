import type { Area2D, Pose2D, Vec2, Vec3 } from './geometry.ts';
import type { EntityId, MapId } from './ids.ts';
import type { SensorColor } from './sensor.ts';

interface EntityBase {
  readonly id: EntityId;
}

/** Straight wall segment from `from` to `to`. */
export interface WallEntity extends EntityBase {
  readonly type: 'wall';
  readonly from: Vec2;
  readonly to: Vec2;
  readonly height: number;
  readonly thickness: number;
}

/** Box resting on the floor. */
export interface BoxEntity extends EntityBase {
  readonly type: 'box';
  readonly position: Vec2;
  readonly size: Vec3;
  /** Rotation about +Y (rad). */
  readonly rotation: number;
  /** Static boxes are immovable; dynamic boxes can be pushed. */
  readonly dynamic: boolean;
}

/** Static cylindrical obstacle (pillar, cone, …). */
export interface ObstacleEntity extends EntityBase {
  readonly type: 'obstacle';
  readonly position: Vec2;
  readonly radius: number;
  readonly height: number;
}

/** Trigger zone the robot must drive through. */
export interface CheckpointEntity extends EntityBase {
  readonly type: 'checkpoint';
  readonly area: Area2D;
  /** Visiting order (1-based). Missions may require checkpoints in order. */
  readonly order: number;
}

/** Line painted on the floor, read by the line sensor. */
export interface LineEntity extends EntityBase {
  readonly type: 'line';
  readonly points: readonly Vec2[];
  readonly width: number;
  readonly closed: boolean;
}

/** Coloured floor patch, read by the color sensor. */
export interface ColorZoneEntity extends EntityBase {
  readonly type: 'colorZone';
  readonly area: Area2D;
  readonly color: Exclude<SensorColor, 'none'>;
}

/**
 * A barrier that opens when the robot waits in front of it: the robot has to
 * rest inside `trigger` for `holdSeconds` (the gate's scanner), then the
 * barrier lifts and stays open for the rest of the run.
 */
export interface GateEntity extends EntityBase {
  readonly type: 'gate';
  readonly from: Vec2;
  readonly to: Vec2;
  readonly height: number;
  readonly thickness: number;
  readonly trigger: Area2D;
  readonly holdSeconds: number;
}

/** Seconds of each light in a traffic light cycle (red → green → yellow → red …). */
export interface SignalCycle {
  readonly red: number;
  readonly green: number;
  readonly yellow: number;
}

/**
 * Timed traffic light. Entering `crossing` while the light is red fails the
 * mission; the floor tile `signal` in front of the stop line shows the light's
 * colour, so the colour sensor can read it.
 */
export interface TrafficLightEntity extends EntityBase {
  readonly type: 'trafficLight';
  /** Where the pole stands. */
  readonly position: Vec2;
  /** Direction the lamps face (rad, towards the arriving robot). */
  readonly facing: number;
  readonly crossing: Area2D;
  readonly signal: Area2D;
  readonly cycle: SignalCycle;
  /** Seconds into the cycle at the start of a run. */
  readonly offset: number;
}

/** What a zone means for the mission. */
export type ZoneKind = 'construction' | 'hazard' | 'delivery';

/**
 * Floor zone with a rule: crates are pushed into a construction zone, cargo
 * is dropped in a delivery zone (only cargo of its colour, when it has one),
 * and entering a hazard zone fails the mission. A zone with a colour is
 * painted, so the colour sensor reads it.
 */
export interface ZoneEntity extends EntityBase {
  readonly type: 'zone';
  readonly kind: ZoneKind;
  readonly area: Area2D;
  readonly color?: CargoColor;
  /** Short floor label ("A", "Bay 2"). */
  readonly label?: string;
}

/** Colours cargo can have (the colour sensor reads them on the pickup tile). */
export type CargoColor = 'red' | 'green' | 'blue' | 'yellow';

export interface CargoItem {
  readonly id: string;
  /** Colour-coded cargo must go to the delivery zone of the same colour. */
  readonly color?: CargoColor;
}

/**
 * A stack of crates waiting to be picked up (`pick` takes the first one). The
 * robot picks from in front of it; `tile` is the floor patch in front of the
 * stack that shows the colour of the next crate.
 */
export interface CargoEntity extends EntityBase {
  readonly type: 'cargo';
  readonly position: Vec2;
  readonly items: readonly CargoItem[];
  readonly tile?: Area2D;
}

/**
 * Obstacle that patrols back and forth between two points: `period` seconds
 * for the way there and back, starting `offset` seconds into its patrol.
 */
export interface MoverEntity extends EntityBase {
  readonly type: 'mover';
  readonly from: Vec2;
  readonly to: Vec2;
  readonly radius: number;
  readonly height: number;
  readonly period: number;
  readonly offset: number;
}

export type MapEntity =
  | WallEntity
  | BoxEntity
  | ObstacleEntity
  | CheckpointEntity
  | LineEntity
  | ColorZoneEntity
  | GateEntity
  | TrafficLightEntity
  | ZoneEntity
  | CargoEntity
  | MoverEntity;

export type MapEntityType = MapEntity['type'];

/** Narrow a MapEntity union by its `type` tag. */
export type MapEntityOf<T extends MapEntityType> = Extract<MapEntity, { type: T }>;

/** Serializable map, authored by teachers or shipped as a built-in. */
export interface MapDefinition {
  readonly id: MapId;
  readonly name: string;
  readonly schemaVersion: 1;
  /** Playable floor size (m), centred on the origin. */
  readonly size: Vec2;
  /** Visual grid cell size (m). */
  readonly gridSize: number;
  readonly floorColor: Exclude<SensorColor, 'none'>;
  readonly start: Pose2D;
  readonly finish: Area2D;
  readonly entities: readonly MapEntity[];
}
