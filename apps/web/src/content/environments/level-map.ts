import { entityId, mapId, Vec2Math, type Area2D, type CargoColor, type MapDefinition, type MapEntity, type Pose2D, type Vec2, type ZoneKind } from '@robolab/shared';

/*
 * Authoring helpers for per-level maps. Every level has its own map (layout,
 * walls, props) that matches its own 3D environment; these helpers keep the
 * geometry precise (routes are traced with the engine's heading convention:
 * 0 = +X, left = counter-clockwise from above).
 */

/** Forward distance in metres, or a 90° turn on the spot. */
export type RouteStep = number | 'L' | 'R';

export interface Route {
  /** Start, every turning point, and the end. */
  readonly points: readonly Vec2[];
  readonly end: Pose2D;
}

/** Follow a turtle route from a start pose. */
export function traceRoute(start: Pose2D, steps: readonly RouteStep[]): Route {
  let { x, z, heading } = start;
  const points: Vec2[] = [{ x, z }];
  for (const s of steps) {
    if (s === 'L') heading += Math.PI / 2;
    else if (s === 'R') heading -= Math.PI / 2;
    else {
      const f = Vec2Math.headingToVector(heading);
      x = round(x + f.x * s);
      z = round(z + f.z * s);
      points.push({ x, z });
    }
  }
  return { points, end: { x, z, heading } };
}

const round = (v: number) => Math.round(v * 1e6) / 1e6 || 0; // never -0 (JSON round trips turn it into 0)

const normalize = (v: Vec2): Vec2 => {
  const l = Vec2Math.length(v) || 1;
  return { x: v.x / l, z: v.z / l };
};

export interface CorridorOptions {
  /** Metres the corridor continues behind the first point (0 = none). */
  readonly extendStart?: number;
  /** Metres the corridor continues past the last point. */
  readonly extendEnd?: number;
  /** Close the start / end with a cross wall. */
  readonly capStart?: boolean;
  readonly capEnd?: boolean;
  readonly height?: number;
  readonly thickness?: number;
}

/**
 * Walls on both sides of a polyline route (mitred at corners), so leaving the
 * route is a collision. Ids are `${prefix}-a<i>` / `${prefix}-b<i>` / caps; the
 * prefix also selects the wall's look in the 3D layer (see `wallStyleOf`).
 */
export function corridorWalls(prefix: string, route: readonly Vec2[], halfWidth: number, opts: CorridorOptions = {}): MapEntity[] {
  const pts = route.map((p) => ({ ...p }));
  const first = pts[0];
  const second = pts[1];
  const last = pts[pts.length - 1];
  const beforeLast = pts[pts.length - 2];
  if (!first || !second || !last || !beforeLast) return [];
  const dir = (a: Vec2, b: Vec2) => normalize({ x: b.x - a.x, z: b.z - a.z });
  if (opts.extendStart) {
    const d = dir(second, first);
    pts[0] = { x: first.x + d.x * opts.extendStart, z: first.z + d.z * opts.extendStart };
  }
  if (opts.extendEnd) {
    const d = dir(beforeLast, last);
    pts[pts.length - 1] = { x: last.x + d.x * opts.extendEnd, z: last.z + d.z * opts.extendEnd };
  }
  const side = (sign: 1 | -1): Vec2[] =>
    pts.map((p, i) => {
      const prev = pts[i - 1];
      const next = pts[i + 1];
      const nOf = (a: Vec2, b: Vec2) => {
        const d = dir(a, b);
        return { x: -d.z * sign, z: d.x * sign };
      };
      const n1 = prev ? nOf(prev, p) : null;
      const n2 = next ? nOf(p, next) : null;
      if (n1 && n2) {
        const m = normalize({ x: n1.x + n2.x, z: n1.z + n2.z });
        const k = halfWidth / Math.max(0.2, m.x * n1.x + m.z * n1.z);
        return { x: round(p.x + m.x * k), z: round(p.z + m.z * k) };
      }
      const n = (n1 ?? n2)!;
      return { x: round(p.x + n.x * halfWidth), z: round(p.z + n.z * halfWidth) };
    });
  const height = opts.height ?? 0.12;
  const thickness = opts.thickness ?? 0.06;
  const out: MapEntity[] = [];
  const wall = (id: string, from: Vec2, to: Vec2) => out.push({ id: entityId(id), type: 'wall', from, to, height, thickness });
  const a = side(1);
  const b = side(-1);
  for (let i = 0; i + 1 < pts.length; i++) {
    wall(`${prefix}-a${i + 1}`, a[i]!, a[i + 1]!);
    wall(`${prefix}-b${i + 1}`, b[i]!, b[i + 1]!);
  }
  if (opts.capStart) wall(`${prefix}-cap0`, a[0]!, b[0]!);
  if (opts.capEnd) wall(`${prefix}-cap1`, a[a.length - 1]!, b[b.length - 1]!);
  return out;
}

export const checkpoint = (order: number, x: number, z: number, radius = 0.22): MapEntity => ({
  id: entityId(`cp-${order}`),
  type: 'checkpoint',
  area: { shape: 'circle', center: { x, z }, radius },
  order,
});

/** Cylindrical obstacle; the id prefix picks the look (`cone`, `rock`, `barrel`, `post`, `stump`). */
export const obstacle = (id: string, x: number, z: number, radius = 0.05, height = 0.12): MapEntity => ({
  id: entityId(id),
  type: 'obstacle',
  position: { x, z },
  radius,
  height,
});

/** Static box; the id prefix picks the look (`crate`, `container`, `shelf`, `block`). */
export const block = (id: string, x: number, z: number, sx: number, sz: number, sy = 0.2, rotation = 0): MapEntity => ({
  id: entityId(id),
  type: 'box',
  position: { x, z },
  size: { x: sx, y: sy, z: sz },
  rotation,
  dynamic: false,
});

/** Pushable supply crate. */
export const supplyCrate = (id: string, x: number, z: number, rotation = 0): MapEntity => ({
  id: entityId(id),
  type: 'box',
  position: { x, z },
  size: { x: 0.12, y: 0.12, z: 0.12 },
  rotation,
  dynamic: true,
});

export const wall = (id: string, from: Vec2, to: Vec2, height = 0.12, thickness = 0.06): MapEntity => ({
  id: entityId(id),
  type: 'wall',
  from,
  to,
  height,
  thickness,
});

/** Square goal area. */
export const goalArea = (x: number, z: number, size = 0.6): Area2D => ({ shape: 'rect', center: { x, z }, size: { x: size, z: size }, rotation: 0 });

export interface LevelMapSpec {
  readonly id: string;
  readonly name: string;
  /** Playable area (m), centred on the origin — leaving it is a crash. */
  readonly size: Vec2;
  readonly start: Pose2D;
  readonly finish: Area2D;
  readonly entities: readonly MapEntity[];
}

/** A level's own map (id `level-<levelId>`). */
export const levelMap = (spec: LevelMapSpec): MapDefinition => ({
  id: mapId(`level-${spec.id}`),
  name: spec.name,
  schemaVersion: 1,
  size: spec.size,
  gridSize: 0.5,
  floorColor: 'white',
  start: spec.start,
  finish: spec.finish,
  entities: spec.entities,
});

// ── Mission objects (Starter Island curriculum) ─────────────────────────────

/** Rectangle area (rotation in rad about +Y). */
export const rect = (x: number, z: number, sx: number, sz: number, rotation = 0): Area2D => ({ shape: 'rect', center: { x, z }, size: { x: sx, z: sz }, rotation });

/** Construction / delivery / hazard zone. */
export const zone = (id: string, kind: ZoneKind, area: Area2D, extra: { color?: CargoColor; label?: string } = {}): MapEntity => ({
  id: entityId(id),
  type: 'zone',
  kind,
  area,
  ...(extra.color && { color: extra.color }),
  ...(extra.label && { label: extra.label }),
});

/** Smart gate from `from` to `to`; opens after the robot rests `hold` s inside `trigger`. */
export const gate = (id: string, from: Vec2, to: Vec2, trigger: Area2D, hold = 1, height = 0.3): MapEntity => ({
  id: entityId(id),
  type: 'gate',
  from,
  to,
  height,
  thickness: 0.06,
  trigger,
  holdSeconds: hold,
});

/** Traffic light: pole, the crossing that must not be entered on red, the signal tile, timetable. */
export const trafficLight = (id: string, spec: { position: Vec2; facing: number; crossing: Area2D; signal: Area2D; red: number; green: number; yellow: number; offset?: number }): MapEntity => ({
  id: entityId(id),
  type: 'trafficLight',
  position: spec.position,
  facing: spec.facing,
  crossing: spec.crossing,
  signal: spec.signal,
  cycle: { red: spec.red, green: spec.green, yellow: spec.yellow },
  offset: spec.offset ?? 0,
});

/** A stack of crates (first = picked first); `tile` shows the next crate's colour. */
export const cargoStack = (id: string, x: number, z: number, colors: readonly (CargoColor | null)[], tile?: Area2D): MapEntity => ({
  id: entityId(id),
  type: 'cargo',
  position: { x, z },
  items: colors.map((c, i) => ({ id: `${id}-${i + 1}`, ...(c && { color: c }) })),
  ...(tile && { tile }),
});

/** Obstacle patrolling between two points (`period` s there and back). */
export const mover = (id: string, from: Vec2, to: Vec2, period: number, offset = 0, radius = 0.1): MapEntity => ({
  id: entityId(id),
  type: 'mover',
  from,
  to,
  radius,
  height: 0.22,
  period,
  offset,
});
