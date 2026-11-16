import type { WorldTheme } from '../../content/worlds/types';
import type { AdventureLayout, Crossing, MapRegion, PlacedStop, Pt, RegionFlavor, WorldAdventure } from './adventure.types';
import { arcLengths, dist, distToLine, indexAt, intersections, rng, smooth, tangent } from './geometry';

/*
 * Turns a world's journey into an island: a winding road that climbs over
 * four terraces (near the camera → far), stops placed along it at uneven,
 * natural intervals, each section between checkpoints/gates a step higher
 * (so gates sit on the climbs), challenge branches off to the side and one
 * river gorge between two terraces, crossed by a bridge at the bend.
 * Pure and deterministic. World units ≈ metres; `Pt.y` is world Z.
 */

/** Terrace centre lines (world Z), nearest the camera first. */
const ROWS = [12.5, 4.4, -3.6, -11.8] as const;
const ROW_X = 15.5;
const BEND = 3.4;
/** Road length before the first stop (the launch pad). */
const START_GAP = 2.4;
const BRANCH = 3.1;
/** Road height of the first section and the climb per section. */
const BASE_Y = 0.55;
const RISE = 0.95;
/** Ramp length (world units, each side) where the road climbs to the next section. */
const RAMP = 1.6;

export const BOUNDS = { minX: -22, maxX: 22, minZ: -17.5, maxZ: 17.5 } as const;
/** Sea / river surface height. */
export const WATER_Y = -0.3;

function buildRoute(seed: number): { route: Pt[]; bends: Pt[] } {
  const r = rng(seed);
  const leftFirst = r() < 0.72;
  const ctrl: Pt[] = [];
  const bends: Pt[] = [];
  ROWS.forEach((row, i) => {
    const ltr = (i % 2 === 0) === leftFirst;
    const n = 6;
    // Rows differ in length and sway so the road never reads as a grid.
    const inL = r() * 2.5;
    const inR = r() * 2.5;
    for (let k = 0; k < n; k++) {
      const f = ltr ? k / (n - 1) : 1 - k / (n - 1);
      const x = -ROW_X + inL + (2 * ROW_X - inL - inR) * f;
      const y = row + (r() - 0.5) * 2.6 + Math.sin(f * Math.PI * 2.2 + i * 1.3 + seed) * 1.3;
      ctrl.push({ x: x + (r() - 0.5) * 1.6, y });
    }
    const next = ROWS[i + 1];
    if (next !== undefined) {
      const edge = (ltr ? 1 : -1) * (ROW_X + BEND);
      const bend = { x: edge + (r() - 0.5) * 1.2, y: (row + next) / 2 + (r() - 0.5) * 0.8 };
      ctrl.push(bend);
      bends.push(bend);
    }
  });
  return { route: smooth(ctrl, 0.2), bends };
}

const FLAVOR_WORDS: readonly [RegionFlavor, RegExp][] = [
  ['arena', /arena|heart|finale|summit station|sky summit/i],
  ['base', /launch|landing|pad|base|depot|canyon gate/i],
  ['tech', /training|camp|station|facility|research|outpost|lab|wing|foundry|industrial|control|observatory|shelter|mining/i],
  ['river', /river|stream|waterfall|basin|frozen|crossing/i],
  ['forest', /forest|jungle|canopy|trail|woods|edge/i],
  ['rocky', /canyon|rock|cliff|valley|pass|arch|tunnel|cave|ruin|temple|glacier|summit|chamber|fields|road|mountain/i],
  ['meadow', /grass|meadow|island|field|garden/i],
];
const FALLBACK: readonly RegionFlavor[] = ['meadow', 'forest', 'rocky', 'tech'];

/** What a region looks like, from its name ("Whispering Forest" → forest). */
export function regionFlavor(name: string, i: number): RegionFlavor {
  return FLAVOR_WORDS.find(([, re]) => re.test(name))?.[0] ?? FALLBACK[i % FALLBACK.length]!;
}

/** Uneven, natural spacing: jittered arc positions that never bunch up. */
function stopArcs(count: number, total: number, seed: number): number[] {
  const r = rng(seed * 11 + 5);
  const step = count > 1 ? (total - START_GAP) / (count - 1) : 0;
  const arcs = Array.from({ length: count }, (_, i) => START_GAP + i * step + (i > 0 && i < count - 1 ? (r() - 0.5) * step * 0.5 : 0));
  for (let i = 1; i < count; i++) arcs[i] = Math.max(arcs[i]!, arcs[i - 1]! + step * 0.62);
  return arcs.map((a) => Math.min(a, total - 0.2));
}

export const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function buildCrossing(route: Pt[], bends: Pt[], anchor: Pt, seed: number): Crossing | null {
  if (!bends.length) return null;
  const bend = [...bends].sort((a, b) => dist(a, anchor) - dist(b, anchor))[0]!;
  const r = rng(seed * 3 + 1);
  const pts: Pt[] = [];
  const n = 10;
  for (let k = 0; k <= n; k++) pts.push({ x: -30 + (k / n) * 60, y: bend.y + Math.sin(k * 1.1 + r() * 2) * 0.9 + (r() - 0.5) * 0.5 });
  const river = smooth(pts, 0.3);
  const hit = intersections(route, river).sort((a, b) => dist(a.p, bend) - dist(b.p, bend))[0];
  if (!hit) return null;
  const t = tangent(route, hit.ia);
  return { river, bridge: hit.p, angle: Math.atan2(t.y, t.x) };
}

/** Challenge: beside its branch stop, on the side with room (off the road, out of the river, on the island). */
function branchPos(route: Pt[], i: number, taken: readonly Pt[], river: readonly Pt[] | null): Pt {
  const t = tangent(route, i);
  const p = route[i]!;
  const options = [1, -1].flatMap((s) =>
    [0, 0.6, -0.6].map((along) => {
      const q = { x: p.x - t.y * BRANCH * s + t.x * along, y: p.y + t.x * BRANCH * s + t.y * along };
      const inside = q.x > BOUNDS.minX + 3 && q.x < BOUNDS.maxX - 3 && q.y > BOUNDS.minZ + 3 && q.y < BOUNDS.maxZ - 3;
      const room = Math.min(distToLine(q, route, 2), ...taken.map((o) => dist(o, q)), river ? distToLine(q, river, 2) - 1.2 : Infinity);
      return { q, score: inside ? room : -1 };
    }),
  );
  return options.sort((a, b) => b.score - a.score)[0]!.q;
}

export function buildLayout(adventure: WorldAdventure, theme: WorldTheme): AdventureLayout {
  const { route, bends } = buildRoute(adventure.seed);
  const lengths = arcLengths(route);
  const total = lengths[lengths.length - 1]!;

  const mainDefs = adventure.stops.filter((s) => s.kind !== 'challenge');
  const arcs = stopArcs(mainDefs.length, total, adventure.seed);
  const routeIndex = arcs.map((a) => indexAt(lengths, a));

  // Terraces: each checkpoint / gate starts a higher section; the road ramps up around it.
  const climbs = mainDefs.flatMap((d, i) => (d.kind === 'checkpoint' || d.kind === 'gate' ? [arcs[i]!] : []));
  const finalArc = arcs[arcs.length - 1]!;
  const routeY = lengths.map((s) => {
    let y = BASE_Y + Math.sin(s * 0.33 + adventure.seed) * 0.08;
    for (const c of climbs) y += RISE * smoothstep(c - RAMP, c + RAMP, s);
    // The final arena sits on its own raised plateau.
    return y + 0.45 * smoothstep(finalArc - 3.2, finalArc - 1.2, s);
  });

  const main: PlacedStop[] = mainDefs.map((def, index) => {
    const i = routeIndex[index]!;
    return { def, pos: route[i]!, h: routeY[i]!, index, t: lengths[i]! / total };
  });

  // Regions: up to halfway to the next stop after their last stop.
  const regions: MapRegion[] = adventure.regions.length ? adventure.regions.map((r, i) => ({ name: r.name, flavor: regionFlavor(r.name, i) })) : [{ name: 'Journey', flavor: 'meadow' }];
  const regionEnds = adventure.regions.map((reg) => {
    const k = main.findIndex((m) => m.def.id === reg.untilStop);
    if (k < 0) return total;
    const next = arcs[k + 1];
    return next === undefined ? total : (arcs[k]! + next) / 2;
  });
  const routeRegion = lengths.map((s) => {
    const k = regionEnds.findIndex((end) => s <= end);
    return k < 0 ? regions.length - 1 : k;
  });

  // The river runs past the first mission after the first checkpoint (e.g. "River Crossing").
  const firstMarker = main.findIndex((m) => m.def.kind === 'checkpoint' || m.def.kind === 'gate');
  const anchor = firstMarker >= 0 ? main[Math.min(main.length - 1, firstMarker + 1)]! : main[Math.floor(main.length / 3)]!;
  const crossing = buildCrossing(route, bends, anchor.pos, adventure.seed);
  const river = crossing?.river ?? null;

  const challenges: PlacedStop[] = [];
  for (const def of adventure.stops) {
    if (def.kind !== 'challenge') continue;
    const branch = main.find((m) => m.def.id === def.branchOf);
    if (!branch) continue;
    const i = routeIndex[branch.index]!;
    const pos = branchPos(route, i, [...main.map((m) => m.pos), ...challenges.map((c) => c.pos)], river);
    challenges.push({ def, pos, h: branch.h + 0.35, index: branch.index, t: branch.t });
  }

  return { theme, bounds: BOUNDS, start: route[0]!, route, routeY, routeRegion, routeIndex, main, challenges, regions, crossing, seed: adventure.seed };
}
