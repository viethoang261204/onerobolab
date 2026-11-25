import {
  entityId,
  mapId,
  missionId,
  robotId,
  Vec2Math,
  type MapDefinition,
  type MapEntity,
  type MapEntityOf,
  type MapEntityType,
  type MapQuery,
  type MissionDefinition,
  type Objective,
  type SimulationSnapshot,
  type WorldSnapshot,
} from '@robolab/shared';
import { describe, expect, it } from 'vitest';
import { MissionTracker } from './mission-tracker.ts';

function stubMap(entities: MapEntity[]): MapQuery {
  const definition: MapDefinition = {
    id: mapId('t'),
    name: 't',
    schemaVersion: 1,
    size: { x: 8, z: 4 },
    gridSize: 0.5,
    floorColor: 'white',
    start: { x: -3, z: 0, heading: 0 },
    finish: { shape: 'circle', center: { x: 3, z: 0 }, radius: 0.3 },
    entities,
  };
  const of = <T extends MapEntityType>(type: T) => definition.entities.filter((e): e is MapEntityOf<T> => e.type === type);
  return {
    definition,
    bounds: { min: { x: -4, z: -2 }, max: { x: 4, z: 2 } },
    entitiesOfType: of,
    surfaceAt: () => ({ color: 'white', lineIntensity: 0 }),
    checkpointsAt: (p) => of('checkpoint').filter((c) => Vec2Math.isPointInArea(c.area, p)),
    isInFinish: (p) => Vec2Math.isPointInArea(definition.finish, p),
    isInBounds: () => true,
    isInArea: (a, p) => Vec2Math.isPointInArea(a, p),
  };
}

const circle = (x: number, z: number, radius = 0.25) => ({ shape: 'circle' as const, center: { x, z }, radius });
const mission = (objectives: Objective[], extra: Partial<MissionDefinition> = {}): MissionDefinition => ({
  id: missionId('m'),
  title: 'm',
  description: '',
  mapId: mapId('t'),
  robotId: robotId('rover'),
  objectives,
  timeLimit: null,
  failOnCollision: true,
  scoring: { completionPoints: 500, checkpointPoints: 100, timeBonus: null, efficiencyBonus: null, collisionPenalty: 100 },
  ...extra,
});

function snap(t: number, x: number, z = 0, extra: { crates?: { x: number; z: number }[]; world?: WorldSnapshot; moving?: boolean } = {}): SimulationSnapshot {
  return {
    tick: Math.round(t * 60),
    time: t,
    phase: 'running',
    robot: { id: robotId('rover'), pose: { x, z, heading: 0 }, velocity: { linear: extra.moving === false ? 0 : 0.25, angular: 0 }, wheelTargets: { left: 0, right: 0 }, status: 'running', odometer: 0 },
    sensors: {},
    program: { state: 'running', activeBlockId: null, variables: {}, executedStatements: 0, error: null },
    contacts: [],
    dynamicEntities: (extra.crates ?? []).map((c, i) => ({ id: entityId(`crate-${i}`), pose: { ...c, heading: 0 } })),
    ...(extra.world && { world: extra.world }),
  };
}

const goal: Objective = { id: 'goal', type: 'reachFinish' };

describe('MissionTracker — mission objects', () => {
  it('counts crates in the construction zone (with progress) before the goal counts', () => {
    const map = stubMap([{ id: entityId('site'), type: 'zone', kind: 'construction', area: { shape: 'rect', center: { x: 0, z: 1 }, size: { x: 1, z: 0.6 }, rotation: 0 } }]);
    const t = new MissionTracker();
    t.load(mission([{ id: 'build', type: 'pushToZone', zoneId: entityId('site'), count: 2 }, goal]), map);
    let s = t.observe(snap(1, 0, 0, { crates: [{ x: 0, z: 1 }, { x: 2, z: -1 }] }));
    expect(s.objectives[0]).toMatchObject({ completed: false, progress: { done: 1, total: 2 } });
    s = t.observe(snap(2, 3, 0, { crates: [{ x: 0, z: 1 }, { x: 0.3, z: 1.1 }] }));
    expect(s.objectives[0]).toMatchObject({ completed: true, progress: { done: 2, total: 2 } });
    expect(s.status).toBe('success');
  });

  it('deliveries count only when correct; a wrong drop fails the mission', () => {
    const map = stubMap([]);
    const t = new MissionTracker();
    t.load(mission([{ id: 'deliver', type: 'deliverCargo', count: 2 }]), map);
    expect(t.observe(snap(1, 0, 0, { world: { carrying: null, openGates: [], drops: [{ itemId: 'a', zoneId: entityId('z'), correct: true }] } })).objectives[0]?.progress).toEqual({ done: 1, total: 2 });
    const s = t.observe(snap(2, 0, 0, { world: { carrying: null, openGates: [], drops: [{ itemId: 'a', zoneId: entityId('z'), correct: true }, { itemId: 'b', zoneId: null, correct: false }] } }));
    expect(s.status).toBe('failure');
    expect(s.failureReason).toBe('wrongDelivery');
  });

  it('fails on entering a hazard zone', () => {
    const t = new MissionTracker();
    t.load(mission([goal]), stubMap([{ id: entityId('flood'), type: 'zone', kind: 'hazard', area: circle(0, 0, 0.4) }]));
    expect(t.observe(snap(1, -1)).status).toBe('running');
    expect(t.observe(snap(2, 0)).failureReason).toBe('hazard');
  });

  it('fails when entering a crossing on red, not on green', () => {
    const light: MapEntity = { id: entityId('light'), type: 'trafficLight', position: { x: 0, z: 1 }, facing: 0, crossing: circle(0, 0, 0.3), signal: circle(-0.5, 0, 0.1), cycle: { red: 4, green: 4, yellow: 1 }, offset: 0 };
    const red = new MissionTracker();
    red.load(mission([goal]), stubMap([light]));
    expect(red.observe(snap(2, 0)).failureReason).toBe('redLight');
    const green = new MissionTracker();
    green.load(mission([goal]), stubMap([light]));
    expect(green.observe(snap(5, 0)).status).toBe('running');
    // Already in the crossing when it turns red: fine.
    expect(green.observe(snap(9.5, 0.1)).status).toBe('running');
  });

  it('ordered checkpoints: skipping ahead fails', () => {
    const map = stubMap([
      { id: entityId('cp-1'), type: 'checkpoint', area: circle(-1, 0), order: 1 },
      { id: entityId('cp-2'), type: 'checkpoint', area: circle(1, 0), order: 2 },
    ]);
    const t = new MissionTracker();
    t.load(mission([goal], { orderedCheckpoints: true }), map);
    expect(t.observe(snap(1, 1)).failureReason).toBe('wrongOrder');
  });

  it('bonus objectives never block success', () => {
    const map = stubMap([{ id: entityId('cp-9'), type: 'checkpoint', area: circle(0, 1.5), order: 1 }]);
    const t = new MissionTracker();
    t.load(mission([{ id: 'cp-9', type: 'reachCheckpoint', checkpointId: entityId('cp-9'), optional: true }, goal]), map);
    const s = t.observe(snap(3, 3));
    expect(s.status).toBe('success');
    expect(s.objectives[0]).toMatchObject({ completed: false, optional: true });
  });
});
