import type { LevelDefinition } from '../../../../content/levels/types';
import { chaseFraming } from '../catalog';
import { onBridge } from '../gameplay/pieces';
import { Vec2Math } from '@robolab/shared';
import { carveWater, distToPolyline, distToSegment, fbm, outsideRect, smoothstep, type HeightFn } from '../terrain/fields';

/** Side of the terrain square (m). Beyond ~12 m fog takes over. */
export const TERRAIN_SIZE = 44;

/** Level-layout queries shared by every environment. */
export function courseMask(level: LevelDefinition) {
  const { scene, map } = level;
  const hx = map.size.x / 2;
  const hz = map.size.z / 2;
  const roadHalf = scene.pathWidth / 2;
  const pathDist = (x: number, z: number) => distToPolyline({ x, z }, scene.path);
  const waterDist = (x: number, z: number) => (scene.water?.length ? Math.min(...scene.water.map((w) => distToPolyline({ x, z }, w.points) - w.width / 2)) : Infinity);
  const onAnyBridge = (x: number, z: number, margin = 0.1) => (scene.bridges ?? []).some((b) => onBridge({ x, z }, b, margin));
  // Sight line of the default chase camera (see CameraRig presetFor('chase')) — kept free of tall props.
  const s = map.start;
  const f = Vec2Math.headingToVector(s.heading);
  const c = chaseFraming(level.environmentId);
  const cam = { x: s.x - f.x * c.back - f.z * c.side, z: s.z - f.z * c.back + f.x * c.side };
  return {
    hx,
    hz,
    pathDist,
    waterDist,
    onAnyBridge,
    /** Free ground for props: off the road (+margin), off water, off the goal and start. */
    free: (x: number, z: number, margin = 0.35) => {
      if (pathDist(x, z) < roadHalf + margin) return false;
      if (waterDist(x, z) < 0.15) return false;
      const f = map.finish.center;
      if (Math.hypot(x - f.x, z - f.z) < 0.7) return false;
      if (Math.hypot(x - map.start.x, z - map.start.z) < 0.6) return false;
      for (const e of map.entities) {
        if (e.type === 'wall') {
          if (distToSegment({ x, z }, e.from, e.to) < e.thickness / 2 + margin + 0.2) return false;
        } else if (e.type === 'gate') {
          if (distToSegment({ x, z }, e.from, e.to) < margin + 0.35) return false;
        } else if (e.type === 'zone' || e.type === 'colorZone' || e.type === 'checkpoint') {
          const r = e.area.shape === 'circle' ? e.area.radius : Math.max(e.area.size.x, e.area.size.z) / 2;
          if (Math.hypot(x - e.area.center.x, z - e.area.center.z) < r + margin + 0.15) return false;
        } else if (e.type === 'cargo' || e.type === 'box' || e.type === 'obstacle') {
          if (Math.hypot(x - e.position.x, z - e.position.z) < margin + 0.35) return false;
        }
      }
      return true;
    },
    inBounds: (x: number, z: number, pad = 0) => Math.abs(x) <= hx + pad && Math.abs(z) <= hz + pad,
    /** Outside the chase camera's sight line (no tall props there). */
    clearView: (x: number, z: number) => distToSegment({ x, z }, { x: cam.x - f.x * 3, z: cam.z - f.z * 3 }, { x: s.x, z: s.z }) > 1.5,
  };
}

export interface LandscapeOptions {
  /** Flat margin beyond the playable area before hills start (m). */
  readonly flat: number;
  /** Hill height near the course. */
  readonly hills: number;
  /** Height of the far horizon ring (hides the terrain edge). */
  readonly horizon: number;
  readonly seed: number;
  /** Extra shaping on top (added before water carving). */
  readonly extra?: HeightFn;
}

/** Flat course + rolling hills + far horizon ring, with the level's water carved in. */
export function landscape(level: LevelDefinition, o: LandscapeOptions): HeightFn {
  const hx = level.map.size.x / 2;
  const hz = level.map.size.z / 2;
  return (x, z) => {
    const out = outsideRect(x, z, hx, hz);
    const near = smoothstep(o.flat, o.flat + 3.5, out) * o.hills * (0.55 + 0.45 * fbm(x * 0.22, z * 0.22, o.seed));
    const far = smoothstep(9, 17, Math.hypot(x, z)) * o.horizon * (0.6 + 0.4 * fbm(x * 0.12, z * 0.12, o.seed + 5));
    const h = near + far + (o.extra ? o.extra(x, z) : 0);
    return carveWater(h, x, z, level.scene.water);
  };
}

/** Terrain y under a prop (so props sit on hills). */
export const groundAt = (height: HeightFn) => (x: number, z: number) => Math.max(0, height(x, z));

/**
 * Where real grass may grow (natural look): off the road and its kerb, off
 * water and bridges, clear of the start pad, the goal marker and any `avoid`
 * points (docks, fountains…).
 */
export function grassRule(level: LevelDefinition, mask: ReturnType<typeof courseMask>, avoid: readonly { x: number; z: number }[] = []) {
  const roadHalf = level.scene.pathWidth / 2 + 0.07;
  const goal = level.map.finish.center;
  const start = level.map.start;
  return (x: number, z: number) =>
    mask.pathDist(x, z) > roadHalf &&
    mask.waterDist(x, z) > 0.1 &&
    !mask.onAnyBridge(x, z, 0.1) &&
    Math.hypot(x - goal.x, z - goal.z) > 0.42 &&
    Math.hypot(x - start.x, z - start.z) > 0.25 &&
    avoid.every((p) => Math.hypot(x - p.x, z - p.z) > 0.45);
}
