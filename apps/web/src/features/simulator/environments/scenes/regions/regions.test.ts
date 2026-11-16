import { describe, expect, it } from 'vitest';
import { LevelRegistry } from '../../../../../content/levels/registry';
import { environmentInfo } from '../../catalog';
import { courseMask, landscape } from '../common';
import { LANDMARKS, type RegionEnvironmentId } from './landmarks';
import { buildRegionProps } from './region-props';
import { pickWeighted, REGIONS } from './regions';

const regionLevels = LevelRegistry.all.filter((l) => l.environmentId in LANDMARKS);
const envOf = (id: string) => id as RegionEnvironmentId;

describe('Starter Island regions', () => {
  it('missions 4–24 each have their own region environment in the catalog', () => {
    const starter = LevelRegistry.byWorld('starter-island').filter((l) => l.number >= 4);
    expect(starter).toHaveLength(21);
    for (const l of starter) {
      expect(l.environmentId in LANDMARKS, l.id).toBe(true);
      expect(environmentInfo(l.environmentId).theme).toBe('starter');
    }
    expect(Object.keys(LANDMARKS)).toHaveLength(21);
  });

  it('weighted picks cover the whole list', () => {
    const list = [['a', 1], ['b', 3]] as const;
    expect(pickWeighted(list, 0)).toBe('a');
    expect(pickWeighted(list, 0.3)).toBe('b');
    expect(pickWeighted(list, 0.999)).toBe('b');
  });

  it.each(regionLevels.map((l) => [l.id, l] as const))('%s: props are deterministic and stay within the draw-call budget', (_, level) => {
    const preset = REGIONS[LANDMARKS[envOf(level.environmentId)].region];
    const height = landscape(level, { flat: preset.flat, hills: preset.hills, horizon: preset.horizon, seed: 5 });
    const a = buildRegionProps(level, envOf(level.environmentId), 'high', height);
    const b = buildRegionProps(level, envOf(level.environmentId), 'high', height);
    expect(a.size).toBe(b.size);
    expect(a.parts.length).toBeLessThanOrEqual(70);
    expect(a.size).toBeLessThan(4000);
    expect(buildRegionProps(level, envOf(level.environmentId), 'low', height).size).toBeLessThan(a.size);
  });

  it.each(regionLevels.map((l) => [l.id, l] as const))('%s: scenery never lands on the road', (_, level) => {
    const preset = REGIONS[LANDMARKS[envOf(level.environmentId)].region];
    const height = landscape(level, { flat: preset.flat, hills: preset.hills, horizon: preset.horizon, seed: 5 });
    const mask = courseMask(level);
    const batch = buildRegionProps(level, envOf(level.environmentId), 'medium', height);
    // Nothing stands on the drivable road (overhead parts such as scanner arches are fine).
    const onRoad = batch.parts.flatMap((p) => p.items).filter((it) => mask.pathDist(it.p[0], it.p[2]) < level.scene.pathWidth / 2 - 0.05 && it.p[1] > -0.35 && it.p[1] < 0.3);
    expect(onRoad.map((it) => it.p.map((v) => v.toFixed(2)).join(" ")), level.id).toEqual([]);
  });
});
