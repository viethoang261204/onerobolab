import {
  moverPosition,
  Vec2Math,
  type EntityId,
  type MapQuery,
  type MoverEntity,
  type PhysicsQuery,
  type Pose2D,
  type RaycastHit,
  type Vec2,
  type Vec3,
} from '@robolab/shared';

/** Footprint of a cargo stack on its pallet (m). */
export const CARGO_RADIUS = 0.08;

/** Student-friendly kind of thing that was hit. */
export type ColliderKind = 'barrier' | 'cone' | 'block' | 'edge' | 'gate' | 'crate' | 'mover';

type Shape =
  | { readonly kind: 'rect'; readonly center: Vec2; readonly half: Vec2; readonly rotation: number }
  | { readonly kind: 'circle'; readonly center: Vec2; readonly radius: number };

export interface Collider {
  /** Map entity id, or 'boundary' for the edge of the course. */
  readonly id: EntityId | 'boundary';
  readonly kind: ColliderKind;
  readonly shape: Shape;
}

export interface Contact {
  readonly id: EntityId | 'boundary';
  readonly kind: ColliderKind;
}

/** Robot-local → world helpers for an oriented rectangle. */
const axes = (rotation: number) => ({ u: Vec2Math.headingToVector(rotation), v: Vec2Math.headingToVector(rotation + Math.PI / 2) });

function corners(center: Vec2, half: Vec2, rotation: number): Vec2[] {
  const { u, v } = axes(rotation);
  return [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ].map(([a = 0, b = 0]) => ({ x: center.x + u.x * half.x * a + v.x * half.z * b, z: center.z + u.z * half.x * a + v.z * half.z * b }));
}

/** Separating-axis test for two convex polygons; returns the minimum translation (unit axis + depth) or null. */
function satOverlap(a: Vec2[], b: Vec2[]): { axis: Vec2; depth: number } | null {
  let best: { axis: Vec2; depth: number } | null = null;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      if (!p1 || !p2) continue;
      const raw = { x: -(p2.z - p1.z), z: p2.x - p1.x };
      const len = Math.hypot(raw.x, raw.z) || 1;
      const axis = { x: raw.x / len, z: raw.z / len };
      const pa = a.map((p) => Vec2Math.dot(p, axis));
      const pb = b.map((p) => Vec2Math.dot(p, axis));
      const depth = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
      if (depth < 0) return null;
      if (!best || depth < best.depth) best = { axis, depth };
    }
  }
  return best;
}

const rectsOverlap = (a: Vec2[], b: Vec2[]): boolean => satOverlap(a, b) !== null;

function circleOverlapsRect(c: Vec2, r: number, center: Vec2, half: Vec2, rotation: number): boolean {
  const local = Vec2Math.rotate(Vec2Math.sub(c, center), -rotation);
  const nx = Math.max(-half.x, Math.min(half.x, local.x));
  const nz = Math.max(-half.z, Math.min(half.z, local.z));
  return Math.hypot(local.x - nx, local.z - nz) <= r;
}

/** Ray vs oriented rectangle (slab test in the rectangle's frame). Returns entry distance. */
function rayRect(o: Vec2, d: Vec2, center: Vec2, half: Vec2, rotation: number): number | null {
  const lo = Vec2Math.rotate(Vec2Math.sub(o, center), -rotation);
  const ld = Vec2Math.rotate(d, -rotation);
  let tMin = -Infinity;
  let tMax = Infinity;
  for (const [p, dir, h] of [
    [lo.x, ld.x, half.x],
    [lo.z, ld.z, half.z],
  ] as const) {
    if (Math.abs(dir) < 1e-12) {
      if (p < -h || p > h) return null;
    } else {
      const t1 = (-h - p) / dir;
      const t2 = (h - p) / dir;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
    }
  }
  if (tMax < Math.max(tMin, 0)) return null;
  return tMin >= 0 ? tMin : 0; // origin inside → hit immediately
}

function rayCircle(o: Vec2, d: Vec2, c: Vec2, r: number): number | null {
  const oc = Vec2Math.sub(o, c);
  const b = Vec2Math.dot(oc, d);
  const cc = Vec2Math.dot(oc, oc) - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t >= 0) return t;
  return cc <= 0 ? 0 : null;
}

/** A pushable crate: where it is now. */
interface Crate {
  readonly id: EntityId;
  readonly start: Vec2;
  center: Vec2;
  readonly half: Vec2;
  readonly rotation: number;
}

const segmentRect = (id: EntityId, kind: ColliderKind, from: Vec2, to: Vec2, thickness: number): Collider => {
  const len = Vec2Math.distance(from, to);
  return {
    id,
    kind,
    shape: {
      kind: 'rect',
      center: { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 },
      half: { x: len / 2 + thickness / 2, z: thickness / 2 },
      rotation: Math.atan2(-(to.z - from.z), to.x - from.x),
    },
  };
};

/**
 * Collision geometry built from the map — the same entities the 3D course is
 * generated from: walls, static blocks, cones (static), plus the mission
 * objects that change during a run:
 *
 *   gates   – barriers until `openGate` (the world rules decide when)
 *   crates  – dynamic boxes the robot pushes (`resolvePushes`); a crate that
 *             would hit anything else stays put, so the robot is blocked
 *   movers  – obstacles patrolling on a timetable (`setTime`)
 *
 * Everything is 2D on the ground plane: pure, deterministic, and testable
 * without a renderer. Implements the Sensor Engine's `PhysicsQuery`.
 */
export class CollisionWorld implements PhysicsQuery {
  /** The static colliders (walls, blocks, cones). */
  readonly colliders: readonly Collider[];
  private readonly gates: readonly Collider[];
  private readonly open = new Set<EntityId>();
  private readonly crates: Crate[];
  private readonly movers: readonly MoverEntity[];
  private time = 0;
  private lastPushes: { crate: Crate; from: Vec2 }[] = [];
  private readonly bounds: { min: Vec2; max: Vec2 };

  constructor(private readonly map: MapQuery) {
    const colliders: Collider[] = [];
    for (const w of map.entitiesOfType('wall')) colliders.push(segmentRect(w.id, 'barrier', w.from, w.to, w.thickness));
    const crates: Crate[] = [];
    for (const b of map.entitiesOfType('box')) {
      const half = { x: b.size.x / 2, z: b.size.z / 2 };
      if (b.dynamic) crates.push({ id: b.id, start: b.position, center: b.position, half, rotation: b.rotation });
      else colliders.push({ id: b.id, kind: 'block', shape: { kind: 'rect', center: b.position, half, rotation: b.rotation } });
    }
    for (const o of map.entitiesOfType('obstacle')) {
      colliders.push({ id: o.id, kind: 'cone', shape: { kind: 'circle', center: o.position, radius: o.radius } });
    }
    // Cargo stacks stand on a pallet: the robot picks from in front of them, driving into one is a crash.
    for (const c of map.entitiesOfType('cargo')) colliders.push({ id: c.id, kind: 'block', shape: { kind: 'circle', center: c.position, radius: CARGO_RADIUS } });
    this.colliders = colliders;
    this.gates = map.entitiesOfType('gate').map((g) => segmentRect(g.id, 'gate', g.from, g.to, g.thickness));
    this.crates = crates;
    this.movers = map.entitiesOfType('mover');
    this.bounds = map.bounds;
  }

  /** Back to the start of a run: crates home, gates closed, movers at t = 0. */
  reset(): void {
    for (const c of this.crates) c.center = c.start;
    this.open.clear();
    this.time = 0;
    this.lastPushes = [];
  }

  /** Simulation time, which places the patrolling obstacles. */
  setTime(t: number): void {
    this.time = t;
  }

  openGate(id: EntityId): void {
    this.open.add(id);
  }

  isGateOpen(id: EntityId): boolean {
    return this.open.has(id);
  }

  /** Current poses of the pushable crates (for the renderer and the mission). */
  cratePoses(): { id: EntityId; pose: Pose2D }[] {
    return this.crates.map((c) => ({ id: c.id, pose: { x: c.center.x, z: c.center.z, heading: c.rotation } }));
  }

  /** Where a patrolling obstacle is now. */
  moverAt(m: MoverEntity): Vec2 {
    return moverPosition(m, this.time);
  }

  /** Every collider at the current moment (statics, closed gates, movers, crates). */
  private *all(skip?: EntityId): Generator<Collider> {
    yield* this.colliders;
    for (const g of this.gates) if (!this.open.has(g.id as EntityId)) yield g;
    for (const m of this.movers) yield { id: m.id, kind: 'mover', shape: { kind: 'circle', center: this.moverAt(m), radius: m.radius } };
    for (const c of this.crates) if (c.id !== skip) yield { id: c.id, kind: 'crate', shape: { kind: 'rect', center: c.center, half: c.half, rotation: c.rotation } };
  }

  kindOf(id: EntityId | 'boundary' | null): ColliderKind {
    if (id === null || id === 'boundary') return 'edge';
    for (const c of this.all()) if (c.id === id) return c.kind;
    return 'barrier';
  }

  /** 2D ray on the ground plane (y is ignored: barriers are treated as full height for sensors). */
  raycast(origin: Vec3, direction: Vec3, maxDistance: number): RaycastHit | null {
    const o = { x: origin.x, z: origin.z };
    const len = Math.hypot(direction.x, direction.z) || 1;
    const d = { x: direction.x / len, z: direction.z / len };
    let best: { t: number; id: EntityId | null } | null = null;
    for (const c of this.all()) {
      const t = c.shape.kind === 'rect' ? rayRect(o, d, c.shape.center, c.shape.half, c.shape.rotation) : rayCircle(o, d, c.shape.center, c.shape.radius);
      if (t !== null && t <= maxDistance && (!best || t < best.t)) best = { t, id: c.id === 'boundary' ? null : c.id };
    }
    // The course edge: distance to where the ray leaves the bounds.
    const exits = [
      d.x > 0 ? (this.bounds.max.x - o.x) / d.x : d.x < 0 ? (this.bounds.min.x - o.x) / d.x : Infinity,
      d.z > 0 ? (this.bounds.max.z - o.z) / d.z : d.z < 0 ? (this.bounds.min.z - o.z) / d.z : Infinity,
    ];
    const edge = Math.max(0, Math.min(...exits));
    if (edge <= maxDistance && (!best || edge < best.t)) best = { t: edge, id: null };
    if (!best) return null;
    return { distance: best.t, point: { x: o.x + d.x * best.t, y: origin.y, z: o.z + d.z * best.t }, entityId: best.id };
  }

  overlapBox(center: Vec3, halfExtents: Vec3, heading: number): readonly (EntityId | 'boundary')[] {
    return this.contacts({ x: center.x, z: center.z, heading }, { x: halfExtents.x, z: halfExtents.z }).map((c) => c.id);
  }

  /** Everything an oriented footprint (half sizes) touches, including the course edge. */
  contacts(pose: Pose2D, half: Vec2): Contact[] {
    const center = { x: pose.x, z: pose.z };
    const box = corners(center, half, pose.heading);
    const out: Contact[] = [];
    for (const c of this.all()) {
      const hit = c.shape.kind === 'rect' ? rectsOverlap(box, corners(c.shape.center, c.shape.half, c.shape.rotation)) : circleOverlapsRect(c.shape.center, c.shape.radius, center, half, pose.heading);
      if (hit) out.push({ id: c.id, kind: c.kind });
    }
    if (box.some((p) => !this.map.isInBounds(p))) out.push({ id: 'boundary', kind: 'edge' });
    return out;
  }

  /**
   * Push every crate the robot's footprint overlaps out of the way (along
   * the shortest separating direction, away from the robot). A crate that
   * would then touch a wall, a gate, another crate, an obstacle or the edge
   * stays where it is — it remains a contact, so the robot is blocked.
   * Returns the ids of the crates that moved.
   */
  resolvePushes(pose: Pose2D, half: Vec2): EntityId[] {
    this.lastPushes = [];
    if (this.crates.length === 0) return [];
    const robot = corners({ x: pose.x, z: pose.z }, half, pose.heading);
    const moved: EntityId[] = [];
    for (const crate of this.crates) {
      const mtv = satOverlap(robot, corners(crate.center, crate.half, crate.rotation));
      if (!mtv) continue;
      const away = Vec2Math.dot(Vec2Math.sub(crate.center, { x: pose.x, z: pose.z }), mtv.axis) >= 0 ? 1 : -1;
      const step = mtv.depth + 1e-4;
      const next = { x: crate.center.x + mtv.axis.x * step * away, z: crate.center.z + mtv.axis.z * step * away };
      const footprint = corners(next, crate.half, crate.rotation);
      let free = footprint.every((p) => this.map.isInBounds(p));
      if (free) {
        for (const c of this.all(crate.id)) {
          const hit = c.shape.kind === 'rect' ? rectsOverlap(footprint, corners(c.shape.center, c.shape.half, c.shape.rotation)) : circleOverlapsRect(c.shape.center, c.shape.radius, next, crate.half, crate.rotation);
          if (hit) {
            free = false;
            break;
          }
        }
      }
      if (!free) continue;
      this.lastPushes.push({ crate, from: crate.center });
      crate.center = next;
      moved.push(crate.id);
    }
    return moved;
  }

  /** Undo the last `resolvePushes` (the robot was stopped by something else this tick). */
  revertPushes(): void {
    for (const { crate, from } of this.lastPushes) crate.center = from;
    this.lastPushes = [];
  }
}
