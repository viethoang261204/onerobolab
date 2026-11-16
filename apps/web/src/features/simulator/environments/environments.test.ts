import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { corridorWalls, traceRoute } from '../../../content/environments/level-map';
import { LevelRegistry } from '../../../content/levels/registry';
import { ONBOARDING_TOURS } from '../../../content/tutorials/onboarding';
import { WorldRegistry } from '../../../content/worlds/registry';
import { openSimulator, openStudio, startMission } from '../../level-selection/start-mission';
import { setProgressStore, useLevelStore } from '../../levels/level-store';
import { LocalProgressStore } from '../../levels/progress';
import { memoryStorage } from '../../persistence/storage';
import { START_ID } from '../../programming/blocks/block-model';
import { createBlock } from '../../programming/blocks/block-utils';
import { checkProgram } from '../../programming/studio/program-check';
import { setProgramStorage, useProgramStore } from '../../programming/state/program-store';
import { useRouterStore } from '../../router/router-store';
import { parseRoute, paths } from '../../router/routes';
import { ISLAND_RADIUS } from '../../world-map/scene/island-decor';
import { islandGround, islandHeight } from '../../world-map/scene/island-terrain';
import { DEFAULT_CHASE, ENVIRONMENTS, chaseFraming, environmentInfo, isEnvironmentId } from './catalog';
import { onBridge, wallStyleAt } from './gameplay/pieces';
import { LIGHTING } from './lighting';
import { PropBatch } from './props/batch';
import { crate, tree } from './props/builders';
import { carveWater, distToPolyline, fbm, layeredColor } from './terrain/fields';

const allDone = () => ({ version: 1 as const, levels: Object.fromEntries(LevelRegistry.all.map((l) => [l.id, { completed: true, bestStars: 3, bestTime: 9, attempts: 1, completedAt: null }])), lastLevelId: null });

describe('routes: Code Studio and Simulator', () => {
  it('parses and builds studio / simulator URLs', () => {
    expect(parseRoute('/studio')).toEqual({ name: 'studio', levelId: null });
    expect(parseRoute('/studio/canyon-03')).toEqual({ name: 'studio', levelId: 'canyon-03' });
    expect(parseRoute('/code/canyon-03')).toEqual({ name: 'studio', levelId: 'canyon-03' });
    expect(parseRoute(paths.studio('frost-01'))).toEqual({ name: 'studio', levelId: 'frost-01' });
    expect(parseRoute(paths.simulator('frost-01'))).toEqual({ name: 'simulator', levelId: 'frost-01' });
    expect(parseRoute('/studio/a/b').name).toBe('notFound');
  });
});

describe('environment registry', () => {
  it('every level has its own environment — no shared generic arena', () => {
    const envIds = LevelRegistry.all.map((l) => l.environmentId);
    expect(new Set(envIds).size).toBe(envIds.length);
    const mapIds = LevelRegistry.all.map((l) => l.map.id);
    expect(new Set(mapIds).size).toBe(mapIds.length);
    for (const id of envIds) expect(isEnvironmentId(id), id).toBe(true);
    // Neighbouring missions in the same world are different places.
    for (const w of WorldRegistry.all) {
      const levels = LevelRegistry.byWorld(w.id);
      for (let i = 1; i < levels.length; i++) expect(levels[i]!.environmentId).not.toBe(levels[i - 1]!.environmentId);
    }
  });

  it('catalog entries are unique, lit, and unknown ids fail loudly', () => {
    const ids = ENVIRONMENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of ENVIRONMENTS) expect(LIGHTING[e.lighting], e.id).toBeDefined();
    expect(() => environmentInfo('generic-arena')).toThrow(/Unknown environment/);
    expect(chaseFraming('starter-courtyard')).toEqual(DEFAULT_CHASE);
    expect(chaseFraming('canyon-passage').height).toBeGreaterThan(DEFAULT_CHASE.height);
  });

  it('world → level → environment: the place matches the world theme', () => {
    for (const level of LevelRegistry.all) {
      const world = WorldRegistry.get(level.world)!;
      expect(environmentInfo(level.environmentId).theme, level.id).toBe(world.theme);
    }
  });
});

describe('level scenes line up with the physics map', () => {
  it.each(LevelRegistry.all.map((l) => [l.id, l] as const))('%s: start on the road, water only crossed on bridges', (_, level) => {
    const { scene, map } = level;
    expect(distToPolyline(map.start, scene.path)).toBeLessThan(0.05);
    // Fog-of-war missions show no road to the goal (the layout changes every run).
    if (!level.fog) expect(distToPolyline(map.finish.center, scene.path)).toBeLessThan(scene.pathWidth);
    // Sample the road: wherever it is over water there must be a bridge.
    for (let i = 0; i + 1 < scene.path.length; i++) {
      const a = scene.path[i]!;
      const b = scene.path[i + 1]!;
      for (let t = 0; t <= 1; t += 0.02) {
        const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
        const wet = (scene.water ?? []).some((w) => distToPolyline(p, w.points) < w.width / 2);
        if (wet) expect((scene.bridges ?? []).some((br) => onBridge(p, br)), `${level.id} (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).toBe(true);
      }
    }
    for (const br of scene.bridges ?? []) expect(distToPolyline(br.from, scene.path) + distToPolyline(br.to, scene.path)).toBeLessThan(0.1);
  });

  it('walls on a bridge become that bridge’s railing', () => {
    const level = LevelRegistry.get('canyon-03')!;
    const br = level.scene.bridges![0]!;
    const mid = { x: (br.from.x + br.to.x) / 2, z: br.from.z + br.width / 2 };
    expect(wallStyleAt('rail-a1', mid, level.scene.bridges)).toBe('rail');
    expect(wallStyleAt('rail-a1', { x: -2.5, z: -0.08 }, level.scene.bridges)).toBe('barrier');
    expect(wallStyleAt('hedge-a1', { x: 0, z: 0 })).toBe('hedge');
  });
});

describe('level-map authoring', () => {
  it('traces turtle routes with the engine heading convention', () => {
    const r = traceRoute({ x: 0, z: 0, heading: 0 }, [1, 'L', 1, 'R', 0.5]);
    expect(r.points).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: -1 },
      { x: 1.5, z: -1 },
    ]);
    expect(r.end.heading).toBeCloseTo(0);
  });

  it('builds mitred corridor walls on both sides', () => {
    const walls = corridorWalls('fence', [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: -2 }], 0.5, { capEnd: true });
    expect(walls).toHaveLength(5);
    const w = walls.find((e) => String(e.id) === 'fence-a1');
    expect(w?.type === 'wall' && Math.abs(w.from.z)).toBeCloseTo(0.5);
  });
});

describe('program readiness', () => {
  it('reports empty, errors, and ready', () => {
    const program = useProgramStore.getState().program;
    const empty = { ...program, blocks: { [START_ID]: { ...program.blocks[START_ID]!, next: null } } };
    expect(checkProgram(empty, 0)).toMatchObject({ ok: false, reason: 'empty' });
    const b = createBlock('motion.forward', []);
    const one = { ...empty, blocks: { ...empty.blocks, [START_ID]: { ...empty.blocks[START_ID]!, next: b.id }, [b.id]: b } };
    expect(checkProgram(one, 2)).toMatchObject({ ok: false, reason: 'errors' });
    expect(checkProgram(one, 0)).toEqual({ ok: true, blocks: 1 });
  });
});

describe('Code Studio ↔ Simulator share one program', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setProgramStorage(memoryStorage());
    setProgressStore(new LocalProgressStore(memoryStorage()));
    useRouterStore.setState({ path: '/', route: parseRoute('/') });
  });
  afterEach(() => vi.useRealTimers());

  it('Start Mission → Edit Program → Test in Simulator keeps the same program', () => {
    expect(startMission('starter-01')).toBe(true);
    expect(useRouterStore.getState().route).toEqual({ name: 'simulator', levelId: 'starter-01' });
    openStudio('starter-01');
    // Student builds a program in the studio.
    expect(useProgramStore.getState().addBlock('motion.forward', { kind: 'after', blockId: START_ID })).not.toBeNull();
    const program = useProgramStore.getState().program;
    openSimulator('starter-01');
    expect(useRouterStore.getState().route).toEqual({ name: 'simulator', levelId: 'starter-01' });
    // The simulator page enters the same level: nothing reloads.
    useLevelStore.getState().enter('starter-01');
    expect(useProgramStore.getState().program).toBe(program);
    openStudio('starter-01');
    useLevelStore.getState().enter('starter-01');
    expect(useRouterStore.getState().route).toEqual({ name: 'studio', levelId: 'starter-01' });
    expect(useProgramStore.getState().program).toBe(program);
  });

  it('each level keeps its own saved program', () => {
    setProgressStore(new LocalProgressStore((() => {
      const s = memoryStorage();
      s.setItem('roboverse.progress.v1', JSON.stringify(allDone()));
      return s;
    })()));
    startMission('starter-01');
    useProgramStore.getState().addBlock('motion.forward', { kind: 'after', blockId: START_ID });
    startMission('canyon-03');
    expect(useProgramStore.getState().program.blocks[START_ID]?.next ?? null).toBeNull();
    startMission('starter-01');
    expect(useProgramStore.getState().program.blocks[START_ID]?.next).not.toBeNull();
  });
});

describe('terrain fields', () => {
  it('noise stays in range and colours are valid', () => {
    for (let i = 0; i < 200; i++) {
      const v = fbm(i * 0.37, i * 0.91, 3);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
    const color = layeredColor({ floor: '#77c75a', floor2: '#86cf66', low: '#6b5a44', mid: '#67bb52', high: '#55a247', cliff: '#8f8a78' });
    for (const c of [color(0, 0, 0, 0), color(1, 1, 2, 0.9), color(2, 2, -1, 0.2)]) for (const v of c) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('water carves a channel below the floor', () => {
    const water = [{ points: [{ x: -2, z: 0 }, { x: 2, z: 0 }], width: 0.6, depth: 0.3 }];
    expect(carveWater(0, 0, 0, water)).toBeLessThan(-0.3);
    expect(carveWater(0, 0, 1, water)).toBe(0);
  });
});

describe('world map dioramas', () => {
  const themes = WorldRegistry.all.map((w) => w.theme);

  it('every island keeps a flat centre pad for the robot', () => {
    for (const t of themes) {
      expect(islandGround(t, 3)(0, 0), t).toBeCloseTo(0, 5);
    }
  });

  it('each world has its own landform (not one shape recoloured)', () => {
    const signature = (t: (typeof themes)[number]) => {
      const h = islandHeight(t, 3);
      const pts: number[] = [];
      for (let a = 0; a < 12; a++) for (const r of [0.7, 1.2, 1.7]) pts.push(Math.round(Math.max(0, h(Math.cos(a) * r * (ISLAND_RADIUS / 2), Math.sin(a) * r * (ISLAND_RADIUS / 2))) * 100));
      return pts.join(',');
    };
    const sigs = themes.map(signature);
    expect(new Set(sigs).size).toBe(themes.length);
  });
});

describe('onboarding tours and prop batching', () => {
  it('one tour per screen', () => {
    expect(ONBOARDING_TOURS.studio.map((s) => s.target)).toContain('test');
    expect(ONBOARDING_TOURS.simulator.map((s) => s.target)).toContain('edit');
  });

  it('prop batches merge instances by geometry × material', () => {
    const b = new PropBatch();
    const rnd = () => 0.5;
    for (let i = 0; i < 20; i++) tree(b, i, 0, 0, 1, rnd);
    crate(b, 0, 0, 0, 0.2, 0);
    // 20 trees + 1 crate = 63 instances, but only a handful of draw groups.
    expect(b.size).toBe(20 * 3 + 3);
    expect(b.parts.length).toBeLessThanOrEqual(4);
  });
});
