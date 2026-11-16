import type { WorldDefinition } from './types';

/**
 * The OneRoboLab journey, in order. A world without levels yet is shown as
 * "coming soon". Map positions form a clockwise circuit (front row → back
 * row) so the whole journey fits between the map's side panels.
 */
export const WORLDS: readonly WorldDefinition[] = [
  {
    id: 'starter-island',
    order: 1,
    name: 'Starter Island',
    tagline: 'Your first commands',
    description: 'A calm test track where your robot takes its first moves. Learn how a program runs step by step, from top to bottom.',
    theme: 'starter',
    color: '#4ade80',
    skills: ['Movement', 'Turning', 'Sequences'],
    difficulty: 1,
    mapPosition: { x: -6.2, y: 0, z: 3.4 },
  },
  {
    id: 'canyon-circuit',
    order: 2,
    name: 'Canyon Circuit',
    tagline: 'Loops and sensors',
    description: 'Winding rock roads and narrow bridges. Repeat patterns with loops and let the distance sensor decide when to stop.',
    theme: 'canyon',
    color: '#fb923c',
    skills: ['Loops', 'Distance sensor', 'Conditions'],
    difficulty: 2,
    mapPosition: { x: -1.4, y: 0.6, z: 4.4 },
  },
  {
    id: 'frost-valley',
    order: 3,
    name: 'Frost Valley',
    tagline: 'The full rescue run',
    description: 'A frozen supply route with checkpoints, cones and barriers. Plan a complete route and deliver the supplies safely.',
    theme: 'frost',
    color: '#7dd3fc',
    skills: ['Planning', 'Checkpoints', 'Precision'],
    difficulty: 3,
    mapPosition: { x: 3.4, y: 0.2, z: 3.0 },
  },
  {
    id: 'jungle-ruins',
    order: 4,
    name: 'Jungle Ruins',
    tagline: 'Follow the line',
    description: 'Overgrown temple paths hide painted guide lines. Read the line sensors and steer your robot through the ruins.',
    theme: 'jungle',
    color: '#34d399',
    skills: ['Line sensors', 'Steering', 'If / else'],
    difficulty: 3,
    mapPosition: { x: 6.0, y: 1.0, z: -1.8 },
  },
  {
    id: 'sky-lab',
    order: 5,
    name: 'Sky Lab',
    tagline: 'Data and variables',
    description: 'A floating research lab full of energy cells and sensors. Count, measure and remember values with variables.',
    theme: 'skylab',
    color: '#a78bfa',
    skills: ['Variables', 'Colour sensor', 'Math'],
    difficulty: 4,
    mapPosition: { x: 1.4, y: 0.5, z: -3.4 },
  },
  {
    id: 'lava-core',
    order: 6,
    name: 'Lava Core',
    tagline: 'Master challenges',
    description: 'An industrial volcano with moving hazards. Combine everything you know to build robust, efficient programs.',
    theme: 'lava',
    color: '#f87171',
    skills: ['Algorithms', 'Optimisation', 'Everything combined'],
    difficulty: 5,
    mapPosition: { x: -3.8, y: 1.3, z: -3.0 },
  },
];

/** Worlds in play: the bundled ones until a signed-in student's catalog replaces them. */
let active: readonly WorldDefinition[] = WORLDS;

/** Use these worlds everywhere (the API catalog after sign-in; `WORLDS` again after sign-out). */
export function setWorldCatalog(worlds: readonly WorldDefinition[]): void {
  active = worlds.length ? worlds : WORLDS;
}

export const WorldRegistry = {
  get all(): readonly WorldDefinition[] {
    return active;
  },
  get(id: string): WorldDefinition | undefined {
    return active.find((w) => w.id === id);
  },
  first(): WorldDefinition {
    return active[0] as WorldDefinition;
  },
  /** The world before this one on the journey, or null for the first. */
  previous(id: string): WorldDefinition | null {
    const i = active.findIndex((w) => w.id === id);
    return i > 0 ? (active[i - 1] ?? null) : null;
  },
};
