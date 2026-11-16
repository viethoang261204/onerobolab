import type { ComponentType } from 'react';
import { environmentInfo, type EnvironmentId, type EnvironmentInfo } from './catalog';
import { LIGHTING, type LightingProfile } from './lighting';
import CampusCrossing from './scenes/CampusCrossing';
import CanyonBridge from './scenes/CanyonBridge';
import CanyonPassage from './scenes/CanyonPassage';
import CanyonWarehouse from './scenes/CanyonWarehouse';
import CreekBridge from './scenes/CreekBridge';
import FrostDepot from './scenes/FrostDepot';
import JungleTrail from './scenes/JungleTrail';
import { regionScene } from './scenes/regions/RegionScene';
import StarterCourtyard from './scenes/StarterCourtyard';
import type { EnvironmentProps } from './types';

/**
 * environmentId → 3D scene. A `Record` over the catalog's id union, so adding
 * a catalog entry without a scene (or the reverse) fails the type check.
 */
const SCENES: Record<EnvironmentId, ComponentType<EnvironmentProps>> = {
  'starter-courtyard': StarterCourtyard,
  'starter-campus-crossing': CampusCrossing,
  'starter-creek-bridge': CreekBridge,
  'starter-meadow-lanes': regionScene('starter-meadow-lanes'),
  'starter-beacon-field': regionScene('starter-beacon-field'),
  'starter-boulder-woods': regionScene('starter-boulder-woods'),
  'starter-log-bridge': regionScene('starter-log-bridge'),
  'starter-ranger-hut': regionScene('starter-ranger-hut'),
  'starter-ferry-landing': regionScene('starter-ferry-landing'),
  'starter-river-docks': regionScene('starter-river-docks'),
  'starter-stepping-stones': regionScene('starter-stepping-stones'),
  'starter-harbour-spiral': regionScene('starter-harbour-spiral'),
  'starter-boat-dock': regionScene('starter-boat-dock'),
  'starter-sensor-lab': regionScene('starter-sensor-lab'),
  'starter-facility-yard': regionScene('starter-facility-yard'),
  'starter-signal-crossing': regionScene('starter-signal-crossing'),
  'starter-rescue-depot': regionScene('starter-rescue-depot'),
  'starter-energy-spiral': regionScene('starter-energy-spiral'),
  'starter-canyon-switchbacks': regionScene('starter-canyon-switchbacks'),
  'starter-gorge-run': regionScene('starter-gorge-run'),
  'starter-supply-outpost': regionScene('starter-supply-outpost'),
  'starter-fallen-trees': regionScene('starter-fallen-trees'),
  'starter-guide-line': regionScene('starter-guide-line'),
  'starter-rescue-city': regionScene('starter-rescue-city'),
  // Old id still stored by databases that haven't run migration 0005.
  'starter-rescue-arena': regionScene('starter-rescue-city'),
  'canyon-passage': CanyonPassage,
  'canyon-warehouse': CanyonWarehouse,
  'canyon-bridge': CanyonBridge,
  'frost-depot': FrostDepot,
  'jungle-trail': JungleTrail,
};

export interface ResolvedEnvironment {
  readonly info: EnvironmentInfo;
  readonly lighting: LightingProfile;
  readonly Scene: ComponentType<EnvironmentProps>;
}

/** Everything needed to render an environment. Unknown ids throw — there is no generic fallback arena. */
export function getEnvironment(id: string): ResolvedEnvironment {
  const info = environmentInfo(id);
  return { info, lighting: LIGHTING[info.lighting], Scene: SCENES[info.id] };
}
