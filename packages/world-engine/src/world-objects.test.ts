import { entityId, mapId, Vec2Math, type MapDefinition, type MapEntity, type MapEntityOf, type MapEntityType, type MapQuery } from '@robolab/shared';
import { describe, expect, it } from 'vitest';
import { WorldObjects } from './world-objects';

function stubMap(entities: MapEntity[]): MapQuery {
  const definition: MapDefinition = {
    id: mapId('t'),
    name: 't',
    schemaVersion: 1,
    size: { x: 6, z: 4 },
    gridSize: 0.5,
    floorColor: 'white',
    start: { x: 0, z: 0, heading: 0 },
    finish: { shape: 'circle', center: { x: 2, z: 0 }, radius: 0.2 },
    entities,
  };
  const bounds = { min: { x: -3, z: -2 }, max: { x: 3, z: 2 } };
  return {
    definition,
    bounds,
    entitiesOfType: <T extends MapEntityType>(type: T) => definition.entities.filter((e): e is MapEntityOf<T> => e.type === type),
    surfaceAt: () => ({ color: 'white', lineIntensity: 0 }),
    checkpointsAt: () => [],
    isInFinish: () => false,
    isInBounds: () => true,
    isInArea: (a, p) => Vec2Math.isPointInArea(a, p),
  };
}

const rect = (x: number, z: number, s = 0.4) => ({ shape: 'rect' as const, center: { x, z }, size: { x: s, z: s }, rotation: 0 });

describe('WorldObjects', () => {
  const map = stubMap([
    { id: entityId('stack'), type: 'cargo', position: { x: 0.25, z: 0 }, items: [{ id: 'a', color: 'red' }, { id: 'b', color: 'blue' }], tile: rect(0.1, 0, 0.12) },
    { id: entityId('red-zone'), type: 'zone', kind: 'delivery', area: rect(1.25, 0), color: 'red' },
    { id: entityId('blue-zone'), type: 'zone', kind: 'delivery', area: rect(-1.25, 0), color: 'blue' },
    { id: entityId('gate'), type: 'gate', from: { x: 2, z: -0.4 }, to: { x: 2, z: 0.4 }, height: 0.3, thickness: 0.06, trigger: rect(1.7, 0, 0.3), holdSeconds: 1 },
    { id: entityId('light'), type: 'trafficLight', position: { x: 0, z: 1 }, facing: 0, crossing: rect(0, 1.5), signal: rect(-0.5, 1.5, 0.2), cycle: { red: 3, green: 3, yellow: 1 }, offset: 0 },
  ]);

  it('picks crates in order from the stack in front of the robot and shows the next colour on its tile', () => {
    const w = new WorldObjects(map);
    expect(w.surfaceColor({ x: 0.1, z: 0 }, 0)).toBe('red');
    expect(w.pick({ x: -1, z: 0, heading: 0 }).ok).toBe(false); // too far
    const first = w.pick({ x: 0, z: 0, heading: 0 });
    expect(first.ok && first.item.id).toBe('a');
    expect(w.pick({ x: 0, z: 0, heading: 0 }).ok).toBe(false); // already carrying
    expect(w.surfaceColor({ x: 0.1, z: 0 }, 0)).toBe('blue');
  });

  it('a drop counts only in a delivery zone of the crate’s colour', () => {
    const w = new WorldObjects(map);
    w.pick({ x: 0, z: 0, heading: 0 }); // red crate
    const ok = w.drop({ x: 1, z: 0, heading: 0 }); // reach point x = 1.25 → red zone
    expect(ok.ok && ok.drop).toEqual({ itemId: 'a', zoneId: 'red-zone', correct: true });
    w.pick({ x: 0, z: 0, heading: 0 }); // blue crate
    const wrong = w.drop({ x: 1, z: 0, heading: 0 });
    expect(wrong.ok && wrong.drop.correct).toBe(false);
    expect(w.drop({ x: 0, z: 0, heading: 0 }).ok).toBe(false); // nothing to drop
    expect(w.snapshot().drops).toHaveLength(2);
    w.reset();
    expect(w.snapshot()).toEqual({ carrying: null, drops: [], openGates: [] });
  });

  it('a gate opens after the robot rests at its scanner for the hold time', () => {
    const w = new WorldObjects(map);
    const at = { x: 1.7, z: 0, heading: 0 };
    for (let k = 0; k < 30; k++) expect(w.update(1 / 60, at, false)).toEqual([]); // moving: no scan
    let opened: string[] = [];
    for (let k = 0; k < 61 && !opened.length; k++) opened = w.update(1 / 60, at, true);
    expect(opened).toEqual(['gate']);
    expect(w.isGateOpen(entityId('gate'))).toBe(true);
  });

  it('the traffic light tile shows the light’s colour', () => {
    const w = new WorldObjects(map);
    expect(w.surfaceColor({ x: -0.5, z: 1.5 }, 1)).toBe('red');
    expect(w.surfaceColor({ x: -0.5, z: 1.5 }, 4)).toBe('green');
    expect(w.surfaceColor({ x: -0.5, z: 1.5 }, 6.5)).toBe('yellow');
    expect(w.surfaceColor({ x: -0.5, z: 1.5 }, 7.5)).toBe('red');
  });
});
