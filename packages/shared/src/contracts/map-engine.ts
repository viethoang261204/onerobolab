import type { Area2D, Rect2D, Vec2 } from '../types/geometry.ts';
import type { CheckpointEntity, MapDefinition, MapEntityOf, MapEntityType } from '../types/map.ts';
import type { EntityId } from '../types/ids.ts';
import type { SensorColor } from '../types/sensor.ts';

/** What the floor looks like at a point, for line/color sensors. */
export interface SurfaceSample {
  readonly color: SensorColor;
  /** 0 = no line, 1 = fully on a line. */
  readonly lineIntensity: number;
}

export interface MapValidationIssue {
  readonly severity: 'error' | 'warning';
  readonly entityId: EntityId | null;
  readonly message: string;
}

/**
 * Read-only, indexed view of a loaded map. Pure geometry queries only;
 * physics colliders are built from `definition` by the Physics Engine.
 */
export interface MapQuery {
  readonly definition: MapDefinition;
  readonly bounds: Rect2D;
  entitiesOfType<T extends MapEntityType>(type: T): readonly MapEntityOf<T>[];
  surfaceAt(point: Vec2): SurfaceSample;
  checkpointsAt(point: Vec2): readonly CheckpointEntity[];
  isInFinish(point: Vec2): boolean;
  isInBounds(point: Vec2): boolean;
  isInArea(area: Area2D, point: Vec2): boolean;
}

/** Map Engine: validates map definitions and builds query structures. */
export interface MapEngine {
  validate(definition: MapDefinition): readonly MapValidationIssue[];
  /** Throws if `validate` reports errors. */
  load(definition: MapDefinition): MapQuery;
}
