import { entityId, type MapDefinition } from '@robolab/shared';
import { describe, expect, it } from 'vitest';
import { createMapEngine, MapValidationError, validateMap } from './map-engine.ts';
import { DEMO_ARENA } from './maps/demo-arena.ts';

describe('validateMap', () => {
  it('accepts the demo arena', () => {
    expect(validateMap(DEMO_ARENA)).toEqual([]);
  });

  it('reports duplicate ids, bad checkpoints and an out-of-bounds start', () => {
    const broken: MapDefinition = {
      ...DEMO_ARENA,
      start: { x: 100, z: 0, heading: 0 },
      entities: [
        { id: entityId('a'), type: 'checkpoint', area: { shape: 'circle', center: { x: 0, z: 0 }, radius: 1 }, order: 1 },
        { id: entityId('a'), type: 'checkpoint', area: { shape: 'circle', center: { x: 1, z: 0 }, radius: 1 }, order: 1 },
      ],
    };
    const messages = validateMap(broken).map((i) => i.message);
    expect(messages).toContain('Start position is outside the map.');
    expect(messages).toContain('Duplicate entity id "a".');
    expect(messages).toContain('Duplicate checkpoint order 1.');
  });
});

describe('MapQuery', () => {
  const map = createMapEngine().load(DEMO_ARENA);

  it('refuses to load an invalid map', () => {
    expect(() => createMapEngine().load({ ...DEMO_ARENA, gridSize: 0 })).toThrow(MapValidationError);
  });

  it('indexes entities by type', () => {
    expect(map.entitiesOfType('wall')).toHaveLength(5);
    expect(map.entitiesOfType('checkpoint').map((c) => c.order)).toEqual([1, 2]);
  });

  it('samples lines, colour zones and bare floor', () => {
    expect(map.surfaceAt({ x: 0, z: 3 })).toEqual({ color: 'black', lineIntensity: 1 });
    expect(map.surfaceAt({ x: -3, z: -0.5 }).color).toBe('red');
    expect(map.surfaceAt({ x: 0, z: 0 })).toEqual({ color: 'white', lineIntensity: 0 });
  });

  it('answers checkpoint, finish and bounds queries', () => {
    expect(map.checkpointsAt({ x: 3, z: 2.5 }).map((c) => c.id)).toEqual(['cp-1']);
    expect(map.isInFinish({ x: 3, z: -3 })).toBe(true);
    expect(map.isInFinish({ x: 0, z: 0 })).toBe(false);
    expect(map.isInBounds({ x: 4.1, z: 0 })).toBe(false);
  });
});
