import type { WorldAdventure } from '../../features/adventure-map/adventure.types';
import { CANYON_CIRCUIT } from './canyon-circuit';
import { FROST_VALLEY } from './frost-valley';
import { JUNGLE_RUINS } from './jungle-ruins';
import { LAVA_CORE } from './lava-core';
import { SKY_LAB } from './sky-lab';
import { STARTER_ISLAND } from './starter-island';

const ADVENTURES: Readonly<Record<string, WorldAdventure>> = Object.fromEntries(
  [STARTER_ISLAND, CANYON_CIRCUIT, FROST_VALLEY, JUNGLE_RUINS, SKY_LAB, LAVA_CORE].map((a) => [a.worldId, a]),
);

/**
 * The adventure map of a world. A world added later in the admin console
 * without an adventure file gets a plain journey built from its levels.
 */
export function adventureFor(worldId: string, levelCount: number): WorldAdventure {
  const authored = ADVENTURES[worldId];
  // Every real level needs a stop (missions and the final): more levels than stops → plain journey.
  const slots = authored?.stops.filter((s) => s.kind === 'mission' || s.kind === 'final').length ?? 0;
  return authored && slots >= levelCount ? authored : fallbackAdventure(worldId, levelCount);
}

export const ALL_ADVENTURES: readonly WorldAdventure[] = Object.values(ADVENTURES);

function fallbackAdventure(worldId: string, levelCount: number): WorldAdventure {
  // One stop per level (filled in order) and a planned finale.
  const stop = (i: number, kind: 'mission' | 'final') => ({
    id: kind === 'final' ? 'final' : `m${String(i + 1).padStart(2, '0')}`,
    kind,
    title: kind === 'final' ? 'World Finale' : `Mission ${i + 1}`,
    description: '',
    skills: [],
    difficulty: 3 as const,
    reward: { xp: 0, stars: 3 },
  });
  const stops = [...Array.from({ length: levelCount }, (_, i) => stop(i, 'mission')), stop(levelCount, 'final')];
  return { worldId, intro: '', seed: [...worldId].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % 1000, stops, regions: [] };
}
