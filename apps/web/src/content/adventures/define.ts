import type { AdventureRegion, AdventureStopDef, WorldAdventure } from '../../features/adventure-map/adventure.types';

/*
 * Tiny authoring helpers so an adventure file reads like the journey:
 *
 *   region('Grassland'),
 *   mission('Move Forward', 'Drive straight…', ['Movement'], 1, 60),
 *   checkpoint('Training Station', '…'),
 *   challenge('Speed Run', '…', ['Loops'], 3, 120),   // branches off the mission before it
 *
 * Ids are generated: m01…, cp1 / gate2 (one shared counter, as on the map),
 * m17a for a challenge after m17, and "final".
 */

type Diff = 1 | 2 | 3 | 4 | 5;

export type Entry =
  | { readonly t: 'region'; readonly name: string }
  | { readonly t: 'mission' | 'challenge' | 'final'; readonly title: string; readonly description: string; readonly skills: readonly string[]; readonly difficulty: Diff; readonly xp: number }
  | { readonly t: 'checkpoint' | 'gate'; readonly title: string; readonly description: string };

export const region = (name: string): Entry => ({ t: 'region', name });
export const mission = (title: string, description: string, skills: readonly string[], difficulty: Diff, xp: number): Entry => ({ t: 'mission', title, description, skills, difficulty, xp });
export const challenge = (title: string, description: string, skills: readonly string[], difficulty: Diff, xp: number): Entry => ({ t: 'challenge', title, description, skills, difficulty, xp });
export const finalMission = (title: string, description: string, skills: readonly string[], difficulty: Diff, xp: number): Entry => ({ t: 'final', title, description, skills, difficulty, xp });
export const checkpoint = (title: string, description: string): Entry => ({ t: 'checkpoint', title, description });
export const gate = (title: string, description: string): Entry => ({ t: 'gate', title, description });

export function defineAdventure(worldId: string, intro: string, seed: number, entries: readonly Entry[]): WorldAdventure {
  const stops: AdventureStopDef[] = [];
  const regions: AdventureRegion[] = [];
  let missions = 0;
  let markers = 0;
  let lastMission: string | null = null;
  let regionName: string | null = null;

  const closeRegion = () => {
    const last = stops.filter((s) => s.kind !== 'challenge').at(-1);
    if (regionName && last && !regions.some((r) => r.untilStop === last.id)) regions.push({ name: regionName, untilStop: last.id });
  };

  for (const e of entries) {
    switch (e.t) {
      case 'region':
        closeRegion();
        regionName = e.name;
        break;
      case 'mission':
      case 'final': {
        missions++;
        const id = e.t === 'final' ? 'final' : `m${String(missions).padStart(2, '0')}`;
        stops.push({ id, kind: e.t, title: e.title, description: e.description, skills: e.skills, difficulty: e.difficulty, reward: { xp: e.xp, stars: 3 } });
        lastMission = id;
        break;
      }
      case 'challenge':
        if (!lastMission) throw new Error(`${worldId}: a challenge needs a mission before it`);
        stops.push({ id: `${lastMission}a`, kind: 'challenge', title: e.title, description: e.description, skills: e.skills, difficulty: e.difficulty, reward: { xp: e.xp, stars: 3 }, branchOf: lastMission });
        break;
      case 'checkpoint':
      case 'gate': {
        markers++;
        stops.push({ id: `${e.t === 'gate' ? 'gate' : 'cp'}${markers}`, kind: e.t, title: e.title, description: e.description, skills: [], difficulty: 1, reward: { xp: 0, stars: 0 } });
        break;
      }
    }
  }
  closeRegion();
  if (stops.at(-1)?.kind !== 'final') throw new Error(`${worldId}: the journey must end with the final mission`);
  return { worldId, intro, seed, stops, regions };
}
