import { entityId, mapId, Vec2Math, type MapDefinition, type MapEntity, type MapEntityOf, type MapEntityType, type MapQuery } from '@robolab/shared';
import { describe, expect, it } from 'vitest';
import { CollisionWorld } from './collision-world';

const HALF = { x: 0.157, z: 0.152 };

function world(entities: MapEntity[]) {
  const def: MapDefinition = {
    id: mapId('t'),
    name: 't',
    schemaVersion: 1,
    size: { x: 6, z: 4 },
    gridSize: 0.5,
    floorColor: 'white',
    start: { x: -2, z: 0, heading: 0 },
    finish: { shape: 'circle', center: { x: 2, z: 0 }, radius: 0.2 },
    entities,
  };
  return new CollisionWorld(stubMap(def));
}

/** Just enough of MapQuery for the collision world (no other engine needed). */
function stubMap(definition: MapDefinition): MapQuery {
  const bounds = { min: { x: -definition.size.x / 2, z: -definition.size.z / 2 }, max: { x: definition.size.x / 2, z: definition.size.z / 2 } };
  return {
    definition,
    bounds,
    entitiesOfType: <T extends MapEntityType>(type: T) => definition.entities.filter((e): e is MapEntityOf<T> => e.type === type),
    surfaceAt: () => ({ color: 'white', lineIntensity: 0 }),
    checkpointsAt: () => [],
    isInFinish: (p) => Vec2Math.isPointInArea(definition.finish, p),
    isInBounds: (p) => p.x >= bounds.min.x && p.x <= bounds.max.x && p.z >= bounds.min.z && p.z <= bounds.max.z,
    isInArea: (a, p) => Vec2Math.isPointInArea(a, p),
  };
}

const crate = (id: string, x: number, z: number): MapEntity => ({ id: entityId(id), type: 'box', position: { x, z }, size: { x: 0.2, y: 0.2, z: 0.2 }, rotation: 0, dynamic: true });

describe('CollisionWorld — mission objects', () => {
  it('pushes a crate ahead of the robot', () => {
    const w = world([crate('c', 0, 0)]);
    // Drive from x = -0.5 to 0.2 in 4 mm steps (one tick at 0.25 m/s): the crate stays just ahead.
    for (let x = -0.5; x <= 0.2; x += 0.004) {
      const pose = { x, z: 0, heading: 0 };
      w.resolvePushes(pose, HALF);
      expect(w.contacts(pose, HALF)).toEqual([]);
    }
    const c = w.cratePoses()[0]!.pose;
    expect(c.x).toBeGreaterThan(0.2 + HALF.x + 0.1 - 0.01);
    expect(c.z).toBeCloseTo(0, 6);
    w.reset();
    expect(w.cratePoses()[0]!.pose.x).toBe(0);
  });

  it('a crate against a wall blocks the robot (and the push is undone)', () => {
    const w = world([crate('c', 0, 0), { id: entityId('wall'), type: 'wall', from: { x: 0.12, z: -1 }, to: { x: 0.12, z: 1 }, height: 0.2, thickness: 0.04 }]);
    let blocked = false;
    for (let x = -0.4; x <= 0; x += 0.004) {
      const pose = { x, z: 0, heading: 0 };
      w.resolvePushes(pose, HALF);
      const hits = w.contacts(pose, HALF);
      if (hits.length) {
        expect(hits.map((h) => h.kind)).toContain('crate');
        w.revertPushes();
        blocked = true;
        break;
      }
    }
    expect(blocked).toBe(true);
    expect(w.cratePoses()[0]!.pose.x).toBeLessThan(0.12 - 0.02 - 0.1 + 1e-3);
  });

  it('sensors see crates, closed gates and moving obstacles; open gates vanish', () => {
    const gate: MapEntity = { id: entityId('g'), type: 'gate', from: { x: 1, z: -0.5 }, to: { x: 1, z: 0.5 }, height: 0.3, thickness: 0.06, trigger: { shape: 'circle', center: { x: 0.7, z: 0 }, radius: 0.2 }, holdSeconds: 1 };
    const w = world([gate]);
    const ray = () => w.raycast({ x: 0, y: 0.1, z: 0 }, { x: 1, y: 0, z: 0 }, 4)?.distance;
    expect(ray()).toBeCloseTo(0.97, 5);
    w.openGate(entityId('g'));
    expect(ray()).toBeCloseTo(3, 5); // the course edge
    w.reset();
    expect(ray()).toBeCloseTo(0.97, 5);

    const m = world([{ id: entityId('m'), type: 'mover', from: { x: 1, z: -1 }, to: { x: 1, z: 1 }, radius: 0.1, height: 0.2, period: 4, offset: 0 }]);
    const hit = (t: number) => {
      m.setTime(t);
      return m.raycast({ x: 0, y: 0.1, z: 0 }, { x: 1, y: 0, z: 0 }, 2)?.entityId ?? null;
    };
    expect(hit(0)).toBeNull(); // at z = -1
    expect(hit(1)).toBe('m'); // crossing z = 0
    expect(hit(2)).toBeNull(); // at z = +1
    expect(hit(3)).toBe('m'); // on the way back
    m.setTime(1);
    expect(m.contacts({ x: 1, z: 0, heading: 0 }, HALF).map((c) => c.kind)).toEqual(['mover']);
  });
});
