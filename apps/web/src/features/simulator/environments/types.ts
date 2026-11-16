import type { MapQuery } from '@robolab/shared';
import type { LevelDefinition } from '../../../content/levels/types';
import type { Quality } from '../../settings/settings-store';

/** Props every environment scene receives. */
export interface EnvironmentProps {
  readonly level: LevelDefinition;
  readonly map: MapQuery;
  readonly quality: Quality;
  readonly reduceMotion: boolean;
}

/** Prop density per quality (scatter counts are multiplied by this). */
export const DENSITY: Record<Quality, number> = { low: 0.5, medium: 0.8, high: 1 };
