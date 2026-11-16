import type { LevelDefinition } from '../../content/levels/types';

/**
 * The four hint tiers of the mission framework: an idea first, then
 * pseudocode, then partial code, and only last the full solution (which
 * costs XP on the server). Levels with fewer hints just number them.
 */
export const HINT_TIERS = ['Idea', 'Pseudocode', 'Partial code', 'Full solution'] as const;

/** Label for hint `i` of a level ("Idea:", or "2." for older levels). */
export function hintTier(level: LevelDefinition, i: number): string {
  return level.hints.length === HINT_TIERS.length ? `${HINT_TIERS[i]}:` : `${i + 1}.`;
}
