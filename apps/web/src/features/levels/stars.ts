import type { LevelDefinition } from '../../content/levels/types';
import { messagesFor } from '../i18n/i18n';
import { levelsMessages } from './levels.messages';

/** Facts about a successful run. */
export interface RunResult {
  readonly time: number;
  readonly blockCount: number;
  readonly collisions: number;
}

export interface StarCriterion {
  readonly id: string;
  /** Shown on the success panel ("Used 5 blocks or fewer"). */
  label(level: LevelDefinition): string;
  met(result: RunResult, level: LevelDefinition): boolean;
}

/**
 * Star rules: one star for finishing, plus one per target met. Add criteria
 * here (or per course) without touching levels or the engine.
 */
export const STAR_CRITERIA: readonly StarCriterion[] = [
  { id: 'complete', label: () => messagesFor(levelsMessages).starComplete, met: () => true },
  {
    id: 'efficient',
    label: (l) => (l.stars.parBlocks !== undefined ? messagesFor(levelsMessages).starBlocks({ n: l.stars.parBlocks }) : messagesFor(levelsMessages).starEfficient),
    met: (r, l) => l.stars.parBlocks === undefined || r.blockCount <= l.stars.parBlocks,
  },
  {
    id: 'fast',
    label: (l) => (l.stars.parSeconds !== undefined ? messagesFor(levelsMessages).starWithin({ s: l.stars.parSeconds }) : messagesFor(levelsMessages).starQuick),
    met: (r, l) => l.stars.parSeconds === undefined || r.time <= l.stars.parSeconds,
  },
];

export interface StarBreakdown {
  readonly stars: 0 | 1 | 2 | 3;
  readonly criteria: readonly { id: string; label: string; met: boolean }[];
}

export function scoreRun(result: RunResult, level: LevelDefinition): StarBreakdown {
  const criteria = STAR_CRITERIA.map((c) => ({ id: c.id, label: c.label(level), met: c.met(result, level) }));
  const stars = Math.min(3, criteria.filter((c) => c.met).length) as StarBreakdown['stars'];
  return { stars, criteria };
}
