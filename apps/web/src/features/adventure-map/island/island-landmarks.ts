import type { AdventureLayout, Pt, RegionFlavor } from '../adventure.types';
import { dist, distToLine, tangent } from '../geometry';
import { WATER_Y } from '../layout';
import type { IslandGround } from './island-terrain';

/*
 * Where the island's landmarks stand (pure): the launch pad, a robot station
 * beside each checkpoint, a gate across the road at each gate, the final
 * arena, the bridge and one set piece per region (research camp, windmill,
 * rock spires…). Shared by the 3D props and the HTML markers.
 */

export interface Spot {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  /** Builder yaw (rotation about +Y). */
  readonly yaw: number;
}

export interface GateSpot extends Spot {
  readonly stopId: string;
  readonly width: number;
}

export interface SetPiece extends Spot {
  readonly flavor: RegionFlavor;
  readonly region: number;
}

export interface WaterfallSpot {
  readonly x: number;
  readonly z: number;
  /** Top of the fall (the cliff edge). */
  readonly top: number;
  readonly width: number;
}

export interface IslandLandmarks {
  readonly startPad: Spot;
  /** Robot station beside each checkpoint (by stop id). */
  readonly stations: ReadonlyMap<string, Spot>;
  readonly gates: readonly GateSpot[];
  readonly arena: Spot | null;
  readonly setPieces: readonly SetPiece[];
  /** Falls from the far cliff into the river gorge. */
  readonly waterfalls: readonly WaterfallSpot[];
  /** Points props must keep clear of (with radius). */
  readonly keepClear: readonly { readonly p: Pt; readonly r: number }[];
}

/** Builder yaw for something facing across the road at route index i (road direction a → yaw −a). */
const roadYaw = (layout: AdventureLayout, i: number) => {
  const t = tangent(layout.route, i);
  return -Math.atan2(t.y, t.x);
};

/** A point beside the road at route index i, on the side with more room. */
function beside(layout: AdventureLayout, ground: IslandGround, i: number, off: number, avoid: readonly Pt[]): Pt {
  const t = tangent(layout.route, i);
  const p = layout.route[i]!;
  const river = layout.crossing?.river;
  return [1, -1]
    .map((s) => {
      const q = { x: p.x - t.y * off * s, y: p.y + t.x * off * s };
      const land = ground.height(q.x, q.y) > 0;
      const room = Math.min(distToLine(q, layout.route, 2), river ? distToLine(q, river, 2) - 1 : Infinity, ...avoid.map((a) => dist(a, q)));
      return { q, score: land ? room : -1 };
    })
    .sort((a, b) => b.score - a.score)[0]!.q;
}

export function islandLandmarks(layout: AdventureLayout, ground: IslandGround): IslandLandmarks {
  const stops = [...layout.main.map((m) => m.pos), ...layout.challenges.map((c) => c.pos)];
  const keepClear: { p: Pt; r: number }[] = stops.map((p) => ({ p, r: 1.3 }));

  const t0 = tangent(layout.route, 0);
  const padAt = { x: layout.start.x - t0.x * 0.9, y: layout.start.y - t0.y * 0.9 };
  const startPad: Spot = { x: padAt.x, z: padAt.y, y: layout.routeY[0]!, yaw: roadYaw(layout, 0) };
  keepClear.push({ p: padAt, r: 3 });

  const stations = new Map<string, Spot>();
  const gates: GateSpot[] = [];
  let arena: Spot | null = null;
  layout.main.forEach((m, k) => {
    const i = layout.routeIndex[k]!;
    if (m.def.kind === 'checkpoint') {
      const q = beside(layout, ground, i, 2.3, stops);
      stations.set(m.def.id, { x: q.x, z: q.y, y: ground.height(q.x, q.y), yaw: roadYaw(layout, i) });
      keepClear.push({ p: q, r: 2.2 });
    } else if (m.def.kind === 'gate') {
      gates.push({ stopId: m.def.id, x: m.pos.x, z: m.pos.y, y: m.h, yaw: roadYaw(layout, i), width: 2.1 });
      keepClear.push({ p: m.pos, r: 2.6 });
    } else if (m.def.kind === 'final') {
      arena = { x: m.pos.x, z: m.pos.y, y: m.h, yaw: roadYaw(layout, i) };
      keepClear.push({ p: m.pos, r: 3.4 });
    }
  });
  if (layout.crossing) keepClear.push({ p: layout.crossing.bridge, r: 2.4 });

  // One set piece per region, beside the road around the region's middle.
  const setPieces: SetPiece[] = [];
  layout.regions.forEach((reg, r) => {
    const idx = layout.routeRegion.flatMap((rr, i) => (rr === r ? [i] : []));
    if (!idx.length || reg.flavor === 'arena') return;
    const i = idx[Math.floor(idx.length / 2)]!;
    const q = beside(layout, ground, i, 3.3, [...stops, ...keepClear.map((k) => k.p)]);
    const y = ground.height(q.x, q.y);
    if (y <= 0.1) return;
    setPieces.push({ x: q.x, z: q.y, y, yaw: roadYaw(layout, i), flavor: reg.flavor, region: r });
    keepClear.push({ p: q, r: 2 });
  });

  // Waterfalls: where the far bank of the gorge is high, away from the bridge.
  const waterfalls: WaterfallSpot[] = [];
  const river = layout.crossing?.river ?? [];
  for (let k = 0; k < river.length && waterfalls.length < 3; k += 6) {
    const p = river[k]!;
    if (p.x < layout.bounds.minX + 5 || p.x > layout.bounds.maxX - 5) continue;
    if (layout.crossing && Math.abs(p.x - layout.crossing.bridge.x) < 5) continue;
    if (waterfalls.some((w) => Math.abs(w.x - p.x) < 7)) continue;
    // Walk from the river towards the far bank until the ground leaves the water: the cliff face.
    let bankZ = Number.NaN;
    for (let dz = 0.4; dz < 3.2; dz += 0.08) {
      if (ground.height(p.x, p.y - dz) > WATER_Y + 0.35) {
        bankZ = p.y - dz + 0.12;
        break;
      }
    }
    if (Number.isNaN(bankZ)) continue;
    const top = ground.height(p.x, bankZ - 0.9);
    if (top < 1.2) continue;
    waterfalls.push({ x: p.x, z: bankZ, top, width: 1.1 });
  }

  return { startPad, stations, gates, arena, setPieces, waterfalls, keepClear };
}
