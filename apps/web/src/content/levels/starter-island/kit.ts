import { entityId, Vec2Math, type Area2D, type MapEntity, type Pose2D, type Vec2 } from '@robolab/shared';
import type { BlockType } from '../../../features/programming/blocks/block-types';

/*
 * Shared authoring bits for Starter Island levels: the toolbox grows one
 * idea at a time as the island teaches it, and painted floor markings
 * (guide lines, colour signals) for the sensor missions.
 */

/** Missions 1–3: drive and turn (grid steps + exact cm). */
export const BASIC: readonly BlockType[] = ['event.start', 'motion.step', 'motion.forward', 'motion.backward', 'motion.turnLeft', 'motion.turnRight', 'motion.stop'];
/** + speed and loops early (from Level 4 onward). */
export const MOVES: readonly BlockType[] = [...BASIC, 'motion.speed', 'control.repeat'];
/** + wait (Traffic Crossing). */
export const TIMING: readonly BlockType[] = [...MOVES, 'control.wait'];
/** + if / if-else and the obstacle sensor (Broken Bridge). */
export const DECISIONS: readonly BlockType[] = [...TIMING, 'control.if', 'control.ifElse', 'sensor.obstacle'];
/** + repeat, pick up and drop (Cargo Station). */
export const CARGO: readonly BlockType[] = [...DECISIONS, 'control.repeat', 'action.pick', 'action.drop'];
/** + the colour sensor (Colour Warehouse). */
export const COLORS: readonly BlockType[] = [...CARGO, 'sensor.color'];
/** + the distance sensor, comparisons and “repeat until” (Smart Gate). */
export const DISTANCE: readonly BlockType[] = [...COLORS, 'sensor.distance', 'logic.compare', 'control.until'];
/** + repeat forever (Traffic Controller). */
export const FOREVER: readonly BlockType[] = [...DISTANCE, 'control.forever'];
/** + the line sensor and and / or / not (Line Rescue onwards). */
export const SENSORS: readonly BlockType[] = [...FOREVER, 'sensor.line', 'logic.not', 'logic.and', 'logic.or'];
/** + variables, maths, mission data and “repeat while” (Bridge Engineer onwards). */
export const VARIABLES: readonly BlockType[] = [...SENSORS, 'control.while', 'variable.set', 'variable.change', 'variable.get', 'math.add', 'math.subtract', 'math.multiply', 'math.divide', 'mission.value'];
/** + break (Rescue Collector onwards). */
export const LOOPS: readonly BlockType[] = [...VARIABLES, 'control.break'];
/** + the robot's position (Delivery Network onwards). */
export const POSITION: readonly BlockType[] = [...LOOPS, 'sensor.robotX', 'sensor.robotY'];
/** + functions (Robot Factory onwards). */
export const FUNCTIONS: readonly BlockType[] = [...POSITION, 'function.define', 'function.call'];
/** + go to x, y (Island Recovery, Arena). */
export const EVERYTHING: readonly BlockType[] = [...FUNCTIONS, 'motion.goTo'];

/** A painted guide line the line sensor can follow. */
export const guideLine = (id: string, points: readonly Vec2[], width = 0.05): MapEntity => ({
  id: entityId(id),
  type: 'line',
  points,
  width,
  closed: false,
});

/** A painted colour tile the colour sensor reads. */
export const colorTile = (id: string, x: number, z: number, color: 'red' | 'green' | 'blue' | 'yellow', sx = 0.3, sz = 0.3): MapEntity => {
  const area: Area2D = { shape: 'rect', center: { x, z }, size: { x: sx, z: sz }, rotation: 0 };
  return { id: entityId(id), type: 'colorZone', area, color };
};

/** Scene road that stops exactly at the route (for levels whose trail has no lead-in). */
export const roadOf = (points: readonly Vec2[], lead = 0.3): Vec2[] => {
  const [a, b] = points;
  if (!a || !b) return [...points];
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return [{ x: a.x - ((b.x - a.x) / l) * lead, z: a.z - ((b.z - a.z) / l) * lead }, ...points];
};

// ── Route geometry for the harder missions ─────────────────────────────────

/** A turtle step: metres forward, a 90° turn, or a turn by any angle (degrees). */
export type Step = number | 'L' | 'R' | readonly ['L' | 'R', number];

/** Like `traceRoute`, with any turn angle (headings follow the engine: L = counter-clockwise). */
export function route(start: Pose2D, steps: readonly Step[]): { points: Vec2[]; end: Pose2D } {
  let { x, z, heading } = start;
  const points: Vec2[] = [{ x, z }];
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6 || 0;
  for (const s of steps) {
    if (s === 'L') heading += Math.PI / 2;
    else if (s === 'R') heading -= Math.PI / 2;
    else if (typeof s !== 'number') heading += ((s[0] === 'L' ? 1 : -1) * s[1] * Math.PI) / 180;
    else {
      const f = Vec2Math.headingToVector(heading);
      x = r6(x + f.x * s);
      z = r6(z + f.z * s);
      points.push({ x, z });
    }
  }
  return { points, end: { x, z, heading } };
}

/** Repeat a list of steps n times (routes that a `repeat` block drives). */
export const times = (n: number, steps: readonly Step[]): Step[] => Array.from({ length: n }, () => steps).flat();

/** Map size (centred on the origin) that contains every point with `margin` around it. */
export function sizeFor(points: readonly Vec2[], margin = 0.9): Vec2 {
  const mx = Math.max(...points.map((p) => Math.abs(p.x)));
  const mz = Math.max(...points.map((p) => Math.abs(p.z)));
  return { x: Math.round((mx + margin) * 20) / 10, z: Math.round((mz + margin) * 20) / 10 };
}

/** Midpoint of route segment i (points[i] → points[i + 1]). */
export function midOf(points: readonly Vec2[], i: number): Vec2 {
  const a = points[i]!;
  const b = points[i + 1]!;
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

/**
 * A straight lane along x (at `laneZ`, from `x0` to `x1`) whose two sides
 * open into dead-end bays. `bays` lists each opening: its x, the side
 * (`-1` = −z, `1` = +z) and its depth. Returns the wall entities.
 */
export function laneWithBays(prefix: string, laneZ: number, x0: number, x1: number, bays: readonly { x: number; side: 1 | -1; depth: number }[], half = 0.42, bayHalf = 0.3): MapEntity[] {
  const out: MapEntity[] = [];
  const w = (id: string, a: Vec2, b: Vec2) => out.push({ id: entityId(id), type: 'wall', from: a, to: b, height: 0.14, thickness: 0.06 });
  w(`${prefix}-cap0`, { x: x0, z: laneZ - half }, { x: x0, z: laneZ + half });
  w(`${prefix}-cap1`, { x: x1, z: laneZ - half }, { x: x1, z: laneZ + half });
  for (const side of [-1, 1] as const) {
    const edge = laneZ + side * half;
    let from = x0;
    let k = 0;
    for (const b of [...bays].filter((b) => b.side === side).sort((a, c) => a.x - c.x)) {
      const back = edge + side * b.depth;
      w(`${prefix}-s${side > 0 ? 'p' : 'n'}${k}`, { x: from, z: edge }, { x: b.x - bayHalf, z: edge });
      w(`${prefix}-b${side > 0 ? 'p' : 'n'}${k}a`, { x: b.x - bayHalf, z: edge }, { x: b.x - bayHalf, z: back });
      w(`${prefix}-b${side > 0 ? 'p' : 'n'}${k}b`, { x: b.x + bayHalf, z: edge }, { x: b.x + bayHalf, z: back });
      w(`${prefix}-b${side > 0 ? 'p' : 'n'}${k}c`, { x: b.x - bayHalf, z: back }, { x: b.x + bayHalf, z: back });
      from = b.x + bayHalf;
      k++;
    }
    w(`${prefix}-s${side > 0 ? 'p' : 'n'}${k}`, { x: from, z: edge }, { x: x1, z: edge });
  }
  return out;
}

/**
 * Perfect maze on a `cols × rows` grid of `cell`-metre cells (seeded
 * depth-first carving — exactly one path between any two cells, so the
 * right-hand rule always finds the exit). Returns the walls and a function
 * giving a cell's centre.
 */
export function maze(prefix: string, cols: number, rows: number, cell: number, origin: Vec2, seed: number) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const open = new Set<string>(); // "c,r|c2,r2" carved passages
  const key = (a: readonly [number, number], b: readonly [number, number]) => (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? `${a}|${b}` : `${b}|${a}`);
  const seen = new Set<string>(['0,0']);
  const stack: [number, number][] = [[0, 0]];
  while (stack.length) {
    const [c, r] = stack[stack.length - 1]!;
    const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      .map(([dc, dr]) => [c + dc, r + dr] as [number, number])
      .filter(([nc, nr]) => nc >= 0 && nr >= 0 && nc < cols && nr < rows && !seen.has(`${nc},${nr}`));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const n = next[Math.floor(rnd() * next.length)]!;
    open.add(key([c, r], n));
    seen.add(`${n[0]},${n[1]}`);
    stack.push(n);
  }
  const center = (c: number, r: number): Vec2 => ({ x: origin.x + (c + 0.5) * cell, z: origin.z - (r + 0.5) * cell });
  const walls: MapEntity[] = [];
  const w = (a: Vec2, b: Vec2) => walls.push({ id: entityId(`${prefix}-${walls.length}`), type: 'wall', from: a, to: b, height: 0.3, thickness: 0.08 });
  const X = (c: number) => origin.x + c * cell;
  const Z = (r: number) => origin.z - r * cell;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (r === 0) w({ x: X(c), z: Z(0) }, { x: X(c + 1), z: Z(0) });
      if (c === 0) w({ x: X(0), z: Z(r) }, { x: X(0), z: Z(r + 1) });
      if (c + 1 >= cols || !open.has(key([c, r], [c + 1, r]))) w({ x: X(c + 1), z: Z(r) }, { x: X(c + 1), z: Z(r + 1) });
      if (r + 1 >= rows || !open.has(key([c, r], [c, r + 1]))) w({ x: X(c), z: Z(r + 1) }, { x: X(c + 1), z: Z(r + 1) });
    }
  }
  /** Shortest path between two cells (centres), for the scene road. */
  const path = (from: readonly [number, number], to: readonly [number, number]): Vec2[] => {
    const prev = new Map<string, string | null>([[`${from}`, null]]);
    const queue: [number, number][] = [[from[0], from[1]]];
    while (queue.length) {
      const [c, r] = queue.shift()!;
      if (c === to[0] && r === to[1]) break;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n: [number, number] = [c + dc, r + dr];
        if (!open.has(key([c, r], n)) || prev.has(`${n}`)) continue;
        prev.set(`${n}`, `${c},${r}`);
        queue.push(n);
      }
    }
    const out: Vec2[] = [];
    for (let k: string | null | undefined = `${to}`; k; k = prev.get(k)) {
      const [c, r] = k.split(',').map(Number);
      out.unshift(center(c!, r!));
    }
    return out;
  };
  /**
   * Every passage of the maze as one polyline (a depth-first walk that goes
   * down each corridor and back), for a floor that shows the corridors
   * without giving away the way out.
   */
  const tour = (): Vec2[] => {
    const out: Vec2[] = [];
    const visited = new Set<string>();
    const walk = (c: number, r: number) => {
      visited.add(`${c},${r}`);
      out.push(center(c, r));
      for (const [dc, dr] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
        const n: [number, number] = [c + dc, r + dr];
        if (!open.has(key([c, r], n)) || visited.has(`${n}`)) continue;
        walk(n[0], n[1]);
        out.push(center(c, r));
      }
    };
    walk(0, 0);
    return out;
  };
  return { walls, center, path, tour };
}

