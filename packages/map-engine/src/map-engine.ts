import {
  Vec2Math,
  type Area2D,
  type CheckpointEntity,
  type MapDefinition,
  type MapEngine,
  type MapEntity,
  type MapEntityOf,
  type MapEntityType,
  type MapQuery,
  type MapValidationIssue,
  type Rect2D,
  type SurfaceSample,
  type Vec2,
} from '@robolab/shared';

/** Line intensity fades to 0 over this distance beyond the line edge (m). */
const LINE_FALLOFF = 0.01;
/** Minimum intensity at which the floor reads as "black" to the color sensor. */
const LINE_COLOR_THRESHOLD = 0.5;

const isFiniteVec = (v: Vec2): boolean => Number.isFinite(v.x) && Number.isFinite(v.z);

const areaCenter = (area: Area2D): Vec2 => area.center;

export function validateMap(map: MapDefinition): readonly MapValidationIssue[] {
  const issues: MapValidationIssue[] = [];
  const error = (message: string, entityId: MapEntity['id'] | null = null) =>
    issues.push({ severity: 'error', entityId, message });
  const warn = (message: string, entityId: MapEntity['id'] | null = null) =>
    issues.push({ severity: 'warning', entityId, message });

  if (!(map.size.x > 0 && map.size.z > 0)) error('Map size must be positive.');
  if (!(map.gridSize > 0)) error('Grid size must be positive.');

  const bounds = boundsOf(map);
  const inBounds = (p: Vec2) =>
    p.x >= bounds.min.x && p.x <= bounds.max.x && p.z >= bounds.min.z && p.z <= bounds.max.z;

  if (!isFiniteVec(map.start) || !Number.isFinite(map.start.heading)) error('Start pose must be finite.');
  else if (!inBounds(map.start)) error('Start position is outside the map.');
  if (!inBounds(areaCenter(map.finish))) error('Finish area centre is outside the map.');

  const ids = new Set<string>();
  const checkpointOrders = new Set<number>();
  for (const entity of map.entities) {
    if (ids.has(entity.id)) error(`Duplicate entity id "${entity.id}".`, entity.id);
    ids.add(entity.id);

    switch (entity.type) {
      case 'wall':
        if (Vec2Math.distance(entity.from, entity.to) === 0) error('Wall has zero length.', entity.id);
        if (!(entity.height > 0 && entity.thickness > 0)) error('Wall height and thickness must be positive.', entity.id);
        break;
      case 'box':
        if (!(entity.size.x > 0 && entity.size.y > 0 && entity.size.z > 0)) error('Box size must be positive.', entity.id);
        if (!inBounds(entity.position)) warn('Box is outside the map.', entity.id);
        break;
      case 'obstacle':
        if (!(entity.radius > 0 && entity.height > 0)) error('Obstacle radius and height must be positive.', entity.id);
        if (!inBounds(entity.position)) warn('Obstacle is outside the map.', entity.id);
        break;
      case 'checkpoint':
        if (!Number.isInteger(entity.order) || entity.order < 1) error('Checkpoint order must be a positive integer.', entity.id);
        else if (checkpointOrders.has(entity.order)) error(`Duplicate checkpoint order ${entity.order}.`, entity.id);
        checkpointOrders.add(entity.order);
        if (!inBounds(areaCenter(entity.area))) error('Checkpoint is outside the map.', entity.id);
        break;
      case 'line':
        if (entity.points.length < 2) error('Line needs at least two points.', entity.id);
        if (!(entity.width > 0)) error('Line width must be positive.', entity.id);
        break;
      case 'colorZone':
        if (!inBounds(areaCenter(entity.area))) warn('Color zone is outside the map.', entity.id);
        break;
      case 'gate':
        if (Vec2Math.distance(entity.from, entity.to) === 0) error('Gate has zero length.', entity.id);
        if (!(entity.height > 0 && entity.thickness > 0)) error('Gate height and thickness must be positive.', entity.id);
        if (!(entity.holdSeconds >= 0)) error('Gate hold time must not be negative.', entity.id);
        break;
      case 'trafficLight': {
        const c = entity.cycle;
        if (!(c.red >= 0 && c.green > 0 && c.yellow >= 0)) error('Traffic light needs a green phase and non-negative red / yellow.', entity.id);
        if (!inBounds(areaCenter(entity.crossing))) error('Traffic light crossing is outside the map.', entity.id);
        break;
      }
      case 'zone':
        if (!inBounds(areaCenter(entity.area))) error('Zone is outside the map.', entity.id);
        break;
      case 'cargo': {
        if (!inBounds(entity.position)) error('Cargo is outside the map.', entity.id);
        const itemIds = new Set(entity.items.map((i) => i.id));
        if (itemIds.size !== entity.items.length) error('Cargo items need unique ids.', entity.id);
        break;
      }
      case 'mover':
        if (!(entity.radius > 0 && entity.height > 0)) error('Mover radius and height must be positive.', entity.id);
        if (!(entity.period > 0)) error('Mover period must be positive.', entity.id);
        if (!inBounds(entity.from) || !inBounds(entity.to)) error('Mover patrols outside the map.', entity.id);
        break;
    }
  }
  return issues;
}

function boundsOf(map: MapDefinition): Rect2D {
  const hx = map.size.x / 2;
  const hz = map.size.z / 2;
  return { min: { x: -hx, z: -hz }, max: { x: hx, z: hz } };
}

function lineIntensityAt(lines: readonly MapEntityOf<'line'>[], p: Vec2): number {
  let best = 0;
  for (const line of lines) {
    const { points } = line;
    const segmentCount = line.closed ? points.length : points.length - 1;
    for (let i = 0; i < segmentCount; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (!a || !b) continue;
      const edgeDistance = Vec2Math.distanceToSegment(p, a, b) - line.width / 2;
      const intensity = edgeDistance <= 0 ? 1 : Math.max(0, 1 - edgeDistance / LINE_FALLOFF);
      if (intensity > best) best = intensity;
      if (best === 1) return 1;
    }
  }
  return best;
}

class LoadedMap implements MapQuery {
  readonly bounds: Rect2D;
  private readonly byType: ReadonlyMap<MapEntityType, readonly MapEntity[]>;

  constructor(readonly definition: MapDefinition) {
    this.bounds = boundsOf(definition);
    const byType = new Map<MapEntityType, MapEntity[]>();
    for (const entity of definition.entities) {
      const list = byType.get(entity.type);
      if (list) list.push(entity);
      else byType.set(entity.type, [entity]);
    }
    this.byType = byType;
  }

  entitiesOfType<T extends MapEntityType>(type: T): readonly MapEntityOf<T>[] {
    // Safe: the bucket for `type` only ever contains entities with that tag.
    return (this.byType.get(type) ?? []) as readonly MapEntityOf<T>[];
  }

  surfaceAt(point: Vec2): SurfaceSample {
    const lineIntensity = lineIntensityAt(this.entitiesOfType('line'), point);
    // Later zones are painted on top of earlier ones; colour tiles over painted mission zones.
    const zones = this.entitiesOfType('colorZone');
    for (let i = zones.length - 1; i >= 0; i--) {
      const zone = zones[i];
      if (zone && Vec2Math.isPointInArea(zone.area, point)) return { color: zone.color, lineIntensity };
    }
    const painted = this.entitiesOfType('zone');
    for (let i = painted.length - 1; i >= 0; i--) {
      const zone = painted[i];
      if (zone?.color && Vec2Math.isPointInArea(zone.area, point)) return { color: zone.color, lineIntensity };
    }
    const color = lineIntensity >= LINE_COLOR_THRESHOLD ? 'black' : this.definition.floorColor;
    return { color, lineIntensity };
  }

  checkpointsAt(point: Vec2): readonly CheckpointEntity[] {
    return this.entitiesOfType('checkpoint').filter((c) => Vec2Math.isPointInArea(c.area, point));
  }

  isInFinish(point: Vec2): boolean {
    return Vec2Math.isPointInArea(this.definition.finish, point);
  }

  isInBounds(point: Vec2): boolean {
    const { min, max } = this.bounds;
    return point.x >= min.x && point.x <= max.x && point.z >= min.z && point.z <= max.z;
  }

  isInArea(area: Area2D, point: Vec2): boolean {
    return Vec2Math.isPointInArea(area, point);
  }
}

export class MapValidationError extends Error {
  constructor(readonly issues: readonly MapValidationIssue[]) {
    super(`Invalid map: ${issues.map((i) => i.message).join(' ')}`);
    this.name = 'MapValidationError';
  }
}

export function createMapEngine(): MapEngine {
  return {
    validate: validateMap,
    load(definition) {
      const errors = validateMap(definition).filter((i) => i.severity === 'error');
      if (errors.length > 0) throw new MapValidationError(errors);
      return new LoadedMap(definition);
    },
  };
}
