import { describe, expect, it } from 'vitest';
import { createMapEngine, validateMap } from '../map-engine.ts';
import { PathBuilder } from './path-builder.ts';
import { RESCUE_SUPPLIES } from './rescue-supplies.ts';

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('PathBuilder', () => {
  it('drives straight along the heading', () => {
    const p = new PathBuilder({ x: 1, z: 2, heading: Math.PI / 2 }).straight(3).pose;
    close(p.x, 1);
    close(p.z, -1); // heading +90° faces -Z
  });

  it('turns left (CCW) and right (CW) around the correct centre', () => {
    const left = new PathBuilder({ x: 0, z: 0, heading: 0 }).arc(1, Math.PI / 2).pose;
    close(left.x, 1);
    close(left.z, -1);
    close(left.heading, Math.PI / 2);

    const right = new PathBuilder({ x: 0, z: 0, heading: 0 }).arc(1, -Math.PI / 2).pose;
    close(right.x, 1);
    close(right.z, 1);
    close(right.heading, -Math.PI / 2);
  });

  it('keeps arc points on the circle', () => {
    const pts = new PathBuilder({ x: 0, z: 0, heading: 0 }).arc(2, Math.PI).points();
    for (const p of pts) close(Math.hypot(p.x - 0, p.z + 2), 2);
  });
});

describe('Rescue the Supplies map', () => {
  it('is valid', () => {
    expect(validateMap(RESCUE_SUPPLIES)).toEqual([]);
  });

  it('starts on the line and ends the main track in the supply area', () => {
    const map = createMapEngine().load(RESCUE_SUPPLIES);
    expect(map.surfaceAt(RESCUE_SUPPLIES.start).lineIntensity).toBe(1);
    const main = map.entitiesOfType('line').find((l) => l.id === 'track-main');
    const end = main?.points[main.points.length - 1];
    expect(end && map.isInFinish({ x: end.x + 0.2, z: end.z })).toBe(true);
  });

  it('has an intersection where the tracks cross', () => {
    const map = createMapEngine().load(RESCUE_SUPPLIES);
    expect(map.surfaceAt({ x: -0.2, z: 0.3 }).lineIntensity).toBe(1);
  });
});
