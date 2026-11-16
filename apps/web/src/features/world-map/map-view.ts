import { LevelRegistry, migrateLevelId } from '../../content/levels/registry';
import type { LevelDefinition } from '../../content/levels/types';
import type { ProgressData } from '../levels/progress';
import { paths } from '../router/routes';
import { journeyPlacement } from './scene/journey-layout';
import type { PathSegment, PathState } from './components/WorldPath';
import { isWorldOpen, statusOfLevel, type WorldSummary } from './world-progress';

export interface ResolvedWorldRoute {
  /** World being explored (URL world, when it can be entered). */
  readonly entered: WorldSummary | null;
  /** Mission whose detail panel is open. */
  readonly level: LevelDefinition | null;
  /** Replace the URL with this (unknown / locked world or mission). */
  readonly redirect: string | null;
  /** World to select after a redirect (so a locked world still shows why). */
  readonly selectId: string | null;
}

/** Validate `/world/:worldId/level/:levelId` against content + progress. */
export function resolveWorldRoute(worldId: string | null, levelId: string | null, summaries: readonly WorldSummary[], progress: ProgressData): ResolvedWorldRoute {
  const none = { entered: null, level: null, redirect: null, selectId: null };
  if (!worldId) return none;
  const summary = summaries.find((s) => s.world.id === worldId);
  if (!summary) return { ...none, redirect: paths.worldMap() };
  if (!isWorldOpen(summary.status)) return { ...none, redirect: paths.worldMap(), selectId: worldId };
  if (!levelId) return { ...none, entered: summary };
  const level = LevelRegistry.get(migrateLevelId(levelId));
  if (!level || level.world !== worldId || statusOfLevel(level.id, progress) === 'locked') return { ...none, entered: summary, redirect: paths.world(worldId) };
  if (level.id !== levelId) return { ...none, entered: summary, redirect: paths.level(worldId, level.id) };
  return { ...none, entered: summary, level };
}

/** Energy cables between consecutive worlds; brightness follows progress. */
export function pathSegments(summaries: readonly WorldSummary[], selectedId: string | null): PathSegment[] {
  const out: PathSegment[] = [];
  for (let i = 1; i < summaries.length; i++) {
    const a = summaries[i - 1]!;
    const b = summaries[i]!;
    const state: PathState = b.status === 'completed' ? 2 : isWorldOpen(b.status) ? 1 : 0;
    const n = summaries.length;
    out.push({ from: a.world, to: b.world, fromAt: journeyPlacement(a.world.order, n), toAt: journeyPlacement(b.world.order, n), state, active: a.world.id === selectedId || b.world.id === selectedId });
  }
  return out;
}
