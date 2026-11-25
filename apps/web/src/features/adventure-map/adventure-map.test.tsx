import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { adventureFor, ALL_ADVENTURES } from '../../content/adventures/registry';
import { LevelRegistry } from '../../content/levels/registry';
import { WorldRegistry } from '../../content/worlds/registry';
import { setLocale } from '../i18n/i18n';
import type { ProgressData } from '../levels/progress';
import { statusOfLevel } from '../world-map/world-progress';
import { adventureView, bindLevels } from './adventure-state';
import { clampCam, FOCUS_DISTANCE, MAX_DISTANCE, MIN_DISTANCE, overviewDistance, panBy, zoomBy } from './camera';
import { MissionDetailPanel } from './components/MissionDetailPanel';
import { WorldSidebar } from './components/WorldSidebar';
import { WorldMap } from './components/WorldMap';
import { dist, distToLine } from './geometry';
import { islandLandmarks } from './island/island-landmarks';
import { sceneryBatch, skyBatch, stateBatch } from './island/island-props';
import { islandGround } from './island/island-terrain';
import { buildLayout, WATER_Y } from './layout';

/** Server render without React's text separators. */
const render = (el: ReactElement) => renderToString(el).replace(/<!-- -->/g, '');
const EMPTY: ProgressData = { version: 1, levels: {}, lastLevelId: null };
const done = (stars = 3) => ({ completed: true, bestStars: stars, bestTime: 10, attempts: 1, completedAt: '2026-09-01T10:00:00.000Z' });

const world = (id: string) => WorldRegistry.get(id)!;
const layoutOf = (id: string) => buildLayout(adventureFor(id, LevelRegistry.byWorld(id).length), world(id).theme);
const viewOf = (id: string, progress: ProgressData, continueLevelId: string | null = null) =>
  adventureView({ layout: layoutOf(id), levels: LevelRegistry.byWorld(id), progress, statusOf: (l) => statusOfLevel(l, progress), continueLevelId });

describe('adventure content', () => {
  it('every world has an adventure of 20–25 missions ending in a final mission', () => {
    for (const w of WorldRegistry.all) {
      const a = ALL_ADVENTURES.find((x) => x.worldId === w.id);
      expect(a, w.id).toBeDefined();
      const missions = a!.stops.filter((s) => s.kind === 'mission' || s.kind === 'final');
      expect(missions.length, w.id).toBeGreaterThanOrEqual(20);
      expect(missions.length, w.id).toBeLessThanOrEqual(25);
      expect(a!.stops.at(-1)!.kind).toBe('final');
      expect(new Set(a!.stops.map((s) => s.id)).size, `${w.id}: unique stop ids`).toBe(a!.stops.length);
      // A checkpoint or gate at least every 8 missions (Starter Island opens with 8).
      let run = 0;
      for (const s of a!.stops) {
        if (s.kind === 'checkpoint' || s.kind === 'gate') run = 0;
        else if (s.kind === 'mission') expect(++run, `${w.id}: missions between markers`).toBeLessThanOrEqual(8);
      }
      // Every real level of the world has a mission stop.
      expect(a!.stops.filter((s) => s.kind === 'mission' || s.kind === 'final').length).toBeGreaterThanOrEqual(LevelRegistry.byWorld(w.id).length);
    }
  });

  it('Starter Island follows the 24-mission journey with checkpoints, gates and a challenge', () => {
    const a = adventureFor('starter-island', 3);
    const main = a.stops.filter((s) => s.kind !== 'challenge');
    expect(main.filter((s) => s.kind === 'mission' || s.kind === 'final')).toHaveLength(24);
    const markers = main.map((s, i) => [s.id, main.slice(0, i).filter((x) => x.kind === 'mission').length] as const).filter(([id]) => /^(cp|gate)/.test(id));
    expect(markers).toEqual([
      ['cp1', 8],
      ['gate2', 13],
      ['cp3', 20],
      ['gate4', 23],
    ]);
    expect(a.stops.find((s) => s.kind === 'challenge')).toMatchObject({ id: 'm17a', branchOf: 'm17' });
    expect(a.stops.at(-1)!.title).toBe('Starter Island Rescue');
  });

  it('a world with more levels than stops falls back to a plain journey with a stop per level', () => {
    const a = adventureFor('starter-island', 40);
    expect(a.stops.filter((s) => s.kind === 'mission')).toHaveLength(40);
    expect(adventureFor('brand-new-world', 2).stops.map((s) => s.kind)).toEqual(['mission', 'mission', 'final']);
  });
});

describe('adventure island layout', () => {
  it('is deterministic and keeps every stop on the island', () => {
    for (const w of WorldRegistry.all) {
      const a = layoutOf(w.id);
      expect(JSON.stringify(layoutOf(w.id))).toBe(JSON.stringify(a));
      const { bounds } = a;
      for (const s of [...a.main, ...a.challenges]) {
        expect(s.pos.x, `${w.id} ${s.def.id}`).toBeGreaterThan(bounds.minX + 2);
        expect(s.pos.x).toBeLessThan(bounds.maxX - 2);
        expect(s.pos.y).toBeGreaterThan(bounds.minZ + 2);
        expect(s.pos.y).toBeLessThan(bounds.maxZ - 2);
      }
    }
  });

  it('stops are spread out (unevenly), challenges sit off the road and out of the river', () => {
    for (const w of WorldRegistry.all) {
      const a = layoutOf(w.id);
      const gaps = a.main.slice(1).map((m, i) => dist(m.pos, a.main[i]!.pos));
      for (const g of gaps) expect(g, w.id).toBeGreaterThan(1.3);
      expect(Math.max(...gaps) - Math.min(...gaps), `${w.id}: natural, uneven spacing`).toBeGreaterThan(0.5);
      for (const c of a.challenges) {
        expect(distToLine(c.pos, a.route), `${w.id} ${c.def.id}`).toBeGreaterThan(2);
        expect(distToLine(c.pos, a.crossing!.river), `${w.id} ${c.def.id} not in the river`).toBeGreaterThan(1);
      }
    }
  });

  it('the road climbs: every checkpoint / gate starts a higher terrace, the final sits highest', () => {
    for (const w of WorldRegistry.all) {
      const a = layoutOf(w.id);
      const markers = a.main.filter((m) => m.def.kind === 'checkpoint' || m.def.kind === 'gate');
      const after = markers.map((m) => a.main[m.index + 1]!.h);
      for (let i = 1; i < after.length; i++) expect(after[i]!, w.id).toBeGreaterThan(after[i - 1]! + 0.5);
      expect(a.main.at(-1)!.h).toBe(Math.max(...a.main.map((m) => m.h)));
    }
  });

  it('the river crosses the road once, at the bridge', () => {
    for (const w of WorldRegistry.all) {
      const a = layoutOf(w.id);
      expect(a.crossing, w.id).not.toBeNull();
      const { river, bridge } = a.crossing!;
      expect(distToLine(bridge, a.route)).toBeLessThan(0.3);
      const wet = a.route.filter((p) => distToLine(p, river) < 0.6);
      expect(wet.length).toBeGreaterThan(0);
      for (const p of wet) expect(dist(p, bridge), w.id).toBeLessThan(2);
    }
  });

  it('ground: flat road bed at stop height, gorge under the bridge, sea around the island', () => {
    const a = layoutOf('starter-island');
    const g = islandGround(a);
    for (const s of a.main) expect(g.height(s.pos.x, s.pos.y), s.def.id).toBeCloseTo(s.h, 1);
    const b = a.crossing!.bridge;
    expect(g.height(b.x, b.y)).toBeLessThan(WATER_Y);
    for (const [x, z] of [[-30, 0], [30, 0], [0, 26], [0, -26]] as const) expect(g.height(x, z)).toBeLessThan(WATER_Y);
  });

  it('landmarks and props: a station per checkpoint, a gate per gate, an arena; within the instance budget', () => {
    for (const w of WorldRegistry.all) {
      const a = layoutOf(w.id);
      const g = islandGround(a);
      const m = islandLandmarks(a, g);
      expect(m.stations.size).toBe(a.main.filter((s) => s.def.kind === 'checkpoint').length);
      expect(m.gates.map((x) => x.stopId)).toEqual(a.main.filter((s) => s.def.kind === 'gate').map((s) => s.def.id));
      expect(m.arena).not.toBeNull();
      const scenery = sceneryBatch(a, g, m);
      expect(scenery.size, w.id).toBeLessThan(9000);
      // Instanced: a few dozen draw calls, however many props.
      expect(scenery.parts.length + skyBatch(a).parts.length, w.id).toBeLessThan(50);
    }
  });

  it('progress props: beacons per stop, a trail only where the road is open', () => {
    const a = layoutOf('starter-island');
    const g = islandGround(a);
    const m = islandLandmarks(a, g);
    const fresh = stateBatch(a, viewOf('starter-island', EMPTY), m).size;
    const later = stateBatch(a, viewOf('starter-island', { ...EMPTY, levels: { 'starter-01': done() } }), m).size;
    expect(later).toBeGreaterThan(fresh);
  });
});

describe('adventure state', () => {
  it('binds real levels to the mission stops and the final in order (explicit ids first)', () => {
    const a = adventureFor('starter-island', 24);
    const levels = LevelRegistry.byWorld('starter-island');
    const bound = [...bindLevels(a.stops, levels)].map(([stop, l]) => [stop, l.id]);
    expect(bound).toHaveLength(24);
    expect(bound.slice(0, 3)).toEqual([
      ['m01', 'starter-01'],
      ['m02', 'starter-02'],
      ['m03', 'starter-03'],
    ]);
    expect(bound.at(-1)).toEqual(['final', 'starter-24']);
    expect(bound.some(([stop]) => stop === 'm17a')).toBe(false); // challenges only by explicit id
    const pinned = a.stops.map((s) => (s.id === 'm05' ? { ...s, levelId: 'starter-02' } : s));
    expect([...bindLevels(pinned, levels)].map(([stop, l]) => [stop, l.id]).slice(0, 3)).toEqual([
      ['m05', 'starter-02'],
      ['m01', 'starter-01'],
      ['m02', 'starter-03'],
    ]);
  });

  it('fresh student: mission 01 is current, the rest locked with reasons, planned ones coming soon', () => {
    const v = viewOf('starter-island', EMPTY);
    const by = (id: string) => v.stops.find((s) => s.id === id)!;
    expect(by('m01')).toMatchObject({ status: 'current', label: '01', title: 'First Delivery', levelId: 'starter-01', planned: false });
    expect(by('m02')).toMatchObject({ status: 'locked', lockReason: 'Complete First Delivery to unlock this mission.' });
    expect(by('m04')).toMatchObject({ status: 'locked', planned: false, title: 'Build the Bridge', levelId: 'starter-04' });
    expect(by('final')).toMatchObject({ planned: false, levelId: 'starter-24' });
    expect(by('m17a')).toMatchObject({ planned: true });
    expect(by('m17a').lockReason).toContain('being built');
    expect(by('cp1')).toMatchObject({ label: 'CHECKPOINT 1', status: 'locked', lockReason: 'Complete missions 01–08 to reach this checkpoint.' });
    expect(by('gate2')).toMatchObject({ label: 'GATE 2', lockReason: 'Complete missions 09–13 to open this gate.' });
    expect(by('m17a')).toMatchObject({ kind: 'challenge', label: '17-A', optional: true });
    expect(by('final')).toMatchObject({ label: '24', kind: 'final' });
    expect(v.current?.id).toBe('m01');
    expect(v.focus).toEqual(by('m01').pos);
    expect([v.missionsCompleted, v.missionsTotal, v.playable]).toEqual([0, 24, 24]);
    expect(v.segments[0]!.state).toBe('open');
    expect(v.segments[1]!.state).toBe('locked');
  });

  it('progress lights the road, moves the current mission and focuses the camera on it', () => {
    const p: ProgressData = { ...EMPTY, levels: { 'starter-01': done(3) }, lastLevelId: 'starter-01' };
    const v = viewOf('starter-island', p, 'starter-02');
    expect(v.stops.find((s) => s.id === 'm01')).toMatchObject({ status: 'completed', bestStars: 3 });
    expect(v.current).toMatchObject({ id: 'm02', status: 'current' });
    expect(v.focus).toEqual(v.current!.pos);
    expect(v.segments.slice(0, 3).map((s) => s.state)).toEqual(['done', 'open', 'locked']);
  });

  it('every playable mission done: nothing current, camera on the last completed mission', () => {
    const p: ProgressData = { ...EMPTY, levels: Object.fromEntries(LevelRegistry.byWorld('starter-island').map((l) => [l.id, done()])) };
    const v = viewOf('starter-island', p);
    expect(v.current).toBeNull();
    expect(v.missionsCompleted).toBe(24);
    expect(v.focus).toEqual(v.stops.find((s) => s.id === 'final')!.pos);
  });

  it('server lock states and admin unlocks are respected', () => {
    const p: ProgressData = {
      ...EMPTY,
      server: {
        states: {
          'starter-01': { status: 'completed', lockReason: null, unlock: [] },
          'starter-02': { status: 'locked', lockReason: 'LOCKED_BY_ADMIN', unlock: [] },
          'starter-03': { status: 'available', lockReason: null, unlock: [] },
        },
        stats: { xp: 0, stars: 0, levelsCompleted: 1, streak: 0 },
      } as unknown as NonNullable<ProgressData['server']>,
      levels: { 'starter-01': done() },
    };
    const v = viewOf('starter-island', p);
    expect(v.stops.find((s) => s.id === 'm02')).toMatchObject({ status: 'locked', lockReason: 'This mission isn’t open yet. Your teacher will unlock it.' });
    expect(v.current?.id).toBe('m03');
  });
});

describe('map camera', () => {
  const view = { width: 1200, height: 800 };
  const b = layoutOf('starter-island').bounds;

  it('keeps the target on the island and the zoom within limits', () => {
    expect(clampCam({ x: 999, z: -999, distance: 1 }, b)).toMatchObject({ distance: MIN_DISTANCE });
    const c = clampCam({ x: 999, z: -999, distance: 999 }, b);
    expect(c.distance).toBe(MAX_DISTANCE);
    expect(c.x).toBeLessThanOrEqual(b.maxX);
    expect(c.z).toBeGreaterThanOrEqual(b.minZ);
  });

  it('dragging moves the ground with the pointer; zoom goes towards the cursor', () => {
    const c = { x: 0, z: 0, distance: FOCUS_DISTANCE };
    expect(panBy(c, 100, 0, view, b).x).toBeLessThan(0); // drag right → look further left
    expect(panBy(c, 0, 100, view, b).z).toBeLessThan(0);
    const z = zoomBy(c, 1.5, { x: 200, y: 0 }, view, b);
    expect(z.distance).toBeCloseTo(FOCUS_DISTANCE / 1.5);
    expect(z.x).toBeGreaterThan(0);
  });

  it('overview fits the island and stays within the zoom range', () => {
    const d = overviewDistance(view, b);
    expect(d).toBeGreaterThan(FOCUS_DISTANCE);
    expect(d).toBeLessThanOrEqual(MAX_DISTANCE);
  });
});

describe('rendering (server render)', () => {
  it('map: one labelled marker per stop, the start banner and camera controls', () => {
    const layout = layoutOf('starter-island');
    const v = viewOf('starter-island', EMPTY);
    const html = render(<WorldMap worldName="Starter Island" layout={layout} view={v} selectedId={null} onOpen={() => undefined} camera={{ current: null }} inset={284} />);
    expect(html.match(/data-stop=/g)).toHaveLength(v.stops.length);
    expect(html).toContain('Mission 01: First Delivery. Current mission');
    expect(html).toContain('Mission 04: Build the Bridge. Locked');
    expect(html).toContain('Coming soon'); // the optional challenge is still being built
    expect(html).toContain('Optional challenge 17-A: Speed Run');
    expect(html).toContain('GATE 2');
    expect(html).toContain('START');
    expect(html).toContain('Go to my mission');
    // Names stay hidden until hover, except the current mission.
    expect(html).toContain('>First Delivery<');
    expect(html).not.toContain('>Basic Navigation<');
  });

  it('sidebar: world, progress, current mission and legend', () => {
    const v = viewOf('starter-island', EMPTY);
    const html = render(<WorldSidebar world={world('starter-island')} intro="Learn the basics." view={v} stars={0} maxStars={9} collapsed={false} onToggle={() => undefined} onContinue={() => undefined} onBack={() => undefined} />);
    expect(html).toContain('World 1');
    expect(html).toContain('Starter Island');
    expect(html).toContain('0 / 24');
    expect(html).toContain('Continue Mission');
    expect(html).toContain('First Delivery');
    for (const l of ['Completed', 'Current', 'Locked', 'Challenge', 'Checkpoint']) expect(html).toContain(l);
  });

  it('detail panel explains locked, planned and gate stops', () => {
    const v = viewOf('starter-island', EMPTY);
    const panel = (id: string) => render(<MissionDetailPanel stop={v.stops.find((s) => s.id === id)!} worldColor="#4ade80" onClose={() => undefined} />);
    expect(panel('m02')).toContain('Complete First Delivery to unlock this mission.');
    const planned = panel('m17a');
    expect(planned).toContain('Coming soon');
    expect(planned).toContain('XP');
    expect(panel('gate2')).toContain('Gate closed');
  });

  it('Vietnamese locale translates adventure HUD, legend, markers and detail panel', () => {
    setLocale('vi');
    try {
      const layout = layoutOf('starter-island');
      const v = viewOf('starter-island', EMPTY);
      const mapHtml = render(<WorldMap worldName="Starter Island" layout={layout} view={v} selectedId={null} onOpen={() => undefined} camera={{ current: null }} inset={0} />);
      expect(mapHtml).toContain('BẮT ĐẦU');
      expect(mapHtml).toContain('Tới nhiệm vụ hiện tại');
      expect(mapHtml).toContain('CỔNG 2');
      const sidebar = render(<WorldSidebar world={world('starter-island')} intro="Learn the basics." view={v} stars={0} maxStars={9} collapsed={false} sheet onToggle={() => undefined} onContinue={() => undefined} onBack={() => undefined} />);
      expect(sidebar).toContain('Thế giới 1');
      expect(sidebar).toContain('Tiếp tục nhiệm vụ');
      expect(sidebar).toContain('Điểm kiểm tra');
      const gatePanel = render(<MissionDetailPanel stop={v.stops.find((s) => s.id === 'gate2')!} worldColor="#4ade80" onClose={() => undefined} />);
      expect(gatePanel).toContain('Cổng đang khoá');
      expect(gatePanel).toContain('Hoàn thành các nhiệm vụ 09–13 để mở cổng này.');
    } finally {
      setLocale('en');
    }
  });
});
