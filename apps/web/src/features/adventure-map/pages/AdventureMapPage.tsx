import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { adventureFor } from '../../../content/adventures/registry';
import { useViewportWidth } from '../../../hooks/useViewportWidth';
import { Analytics } from '../../analytics/analytics';
import { useLocale, useMessages } from '../../i18n/i18n';
import { LevelDetailPanel } from '../../level-selection/components/LevelDetailPanel';
import { startMission } from '../../level-selection/start-mission';
import { useLevelStore } from '../../levels/level-store';
import { navigate } from '../../router/router-store';
import { paths } from '../../router/routes';
import { resolveWorldRoute } from '../../world-map/map-view';
import { useWorldMapStore } from '../../world-map/world-map.store';
import { continueTarget, statusOfLevel, summarizeWorlds } from '../../world-map/world-progress';
import { adventureMapMessages } from '../adventure-map.messages';
import { adventureView } from '../adventure-state';
import type { StopView } from '../adventure.types';
import { MissionDetailPanel } from '../components/MissionDetailPanel';
import { WorldMap } from '../components/WorldMap';
import { HUD_WIDTH, WorldSidebar } from '../components/WorldSidebar';
import { buildLayout } from '../layout';
import type { MapCamera } from '../scene3d/CameraRig';

/** Below this width the world panel starts collapsed (tablets). */
const COLLAPSE_BELOW = 1180;
/** Below this width the HUD uses a compact top bar + bottom sheet. */
const SHEET_BELOW = 1024;

/**
 * `/world/:worldId[/level/:levelId]` — inside a world: the adventure map.
 * Open missions show the full briefing (URL `/level/:id`, shareable);
 * locked / planned stops, checkpoints and gates show a small detail panel.
 * Everything shown is derived from the level progress and the catalog.
 */
export default function AdventureMapPage({ worldId, levelId }: { worldId: string; levelId: string | null }) {
  const m = useMessages(adventureMapMessages);
  const locale = useLocale();
  const progress = useLevelStore((s) => s.progress);
  const summaries = useMemo(() => summarizeWorlds(progress), [progress, locale]);
  const resolved = useMemo(() => resolveWorldRoute(worldId, levelId, summaries, progress), [worldId, levelId, summaries, progress]);
  const summary = resolved.entered;

  useEffect(() => {
    if (resolved.selectId) useWorldMapStore.getState().select(resolved.selectId);
    if (resolved.redirect) navigate(resolved.redirect, { replace: true });
  }, [resolved]);

  const enteredId = summary?.world.id;
  useEffect(() => {
    if (enteredId) Analytics.track('world_entered', { world: enteredId });
  }, [enteredId]);

  const world = summary?.world ?? null;
  const levelCount = summary?.levels.length ?? 0;
  const adventure = useMemo(() => (world ? adventureFor(world.id, levelCount) : null), [world, levelCount]);
  const layout = useMemo(() => (adventure && world ? buildLayout(adventure, world.theme) : null), [adventure, world]);
  const view = useMemo(
    () =>
      layout && summary
        ? adventureView({ layout, levels: summary.levels, progress, statusOf: (id) => statusOfLevel(id, progress), continueLevelId: continueTarget(progress).level.id })
        : null,
    [layout, summary, progress, locale],
  );

  const camera = useRef<MapCamera | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const width = useViewportWidth();
  const compact = width < SHEET_BELOW;
  const [collapsedPref, setCollapsed] = useState<boolean | null>(null);
  const collapsed = collapsedPref ?? width < COLLAPSE_BELOW;
  useEffect(() => setSelectedId(null), [worldId]);

  const open = useCallback(
    (stop: StopView) => {
      if (stop.levelId && stop.status !== 'locked') {
        setSelectedId(null);
        navigate(paths.level(worldId, stop.levelId));
      } else setSelectedId(stop.id);
    },
    [worldId],
  );
  const onContinue = useCallback(
    (stop: StopView) => {
      camera.current?.focus(stop.pos, 1);
      open(stop);
    },
    [open],
  );

  // Esc: close the briefing, else leave the world (panels handle their own Esc first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (levelId) navigate(paths.world(worldId));
      else if (!selectedId) navigate(paths.worldMap());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [levelId, worldId, selectedId]);

  if (!summary || !world || !layout || !view || !adventure) return <main className="flex-1 bg-[#060d24]" aria-busy="true" />;

  const selected = selectedId ? (view.stops.find((s) => s.id === selectedId) ?? null) : null;
  const level = resolved.level;
  const levelStop = level ? view.stops.find((s) => s.levelId === level.id) : undefined;
  const inset = compact ? 0 : (collapsed ? HUD_WIDTH.collapsed : HUD_WIDTH.open) + 12;

  return (
    <main className="relative min-h-0 flex-1 overflow-hidden animate-page-in" aria-label={m.pageAria({ worldName: world.name })}>
      <ErrorBoundary title={m.mapErrorTitle}>
        <WorldMap worldName={world.name} layout={layout} view={view} selectedId={selectedId ?? levelStop?.id ?? null} onOpen={open} camera={camera} inset={inset} />
      </ErrorBoundary>

      <div className={compact ? 'pointer-events-none absolute inset-x-2 top-2 z-20 sm:inset-x-3 sm:top-3' : 'pointer-events-none absolute inset-y-0 left-0 flex flex-col p-3'}>
        <WorldSidebar
          world={world}
          intro={adventure.intro}
          view={view}
          stars={summary.stars}
          maxStars={summary.maxStars}
          collapsed={collapsed}
          sheet={compact}
          onToggle={() => setCollapsed(!collapsed)}
          onContinue={onContinue}
          onBack={() => navigate(paths.worldMap())}
        />
      </div>

      {selected && <MissionDetailPanel stop={selected} worldColor={world.color} onClose={() => setSelectedId(null)} />}
      {level && (
        <LevelDetailPanel
          level={level}
          world={world}
          status={statusOfLevel(level.id, progress)}
          progress={progress.levels[level.id]}
          skills={levelStop?.skills}
          onStart={(id) => startMission(id)}
          onBack={() => navigate(paths.world(worldId))}
        />
      )}
    </main>
  );
}
