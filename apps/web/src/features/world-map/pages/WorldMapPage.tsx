import { Hand, MousePointerClick } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { useViewportWidth } from '../../../hooks/useViewportWidth';
import { useLevelStore } from '../../levels/level-store';
import { navigate } from '../../router/router-store';
import { paths } from '../../router/routes';
import { WorldDetailPanel } from '../components/WorldDetailPanel';
import { MapLabels } from '../components/MapLabels';
import { WorldJourneyList } from '../components/WorldJourneyList';
import { pathSegments } from '../map-view';
import { journeyPlacement } from '../scene/journey-layout';
import { useWorldMapStore } from '../world-map.store';
import type { IslandView, MapInsets } from '../world-map.types';
import { currentWorld, summarizeWorlds } from '../world-progress';

const WorldMapCanvas = lazy(() => import('../components/WorldMapCanvas'));

/** Layout (px) — also fed to the camera so islands centre in the visible area. */
const RAIL = { wide: 264, narrow: 64 } as const;
const PANEL = { wide: 340, narrow: 316 } as const;
const GAP = 16;

function MapLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_50%_70%,#2a4a8f_0%,#0f1f4a_45%,#060d24_100%)]" role="status" aria-label="Loading the world map">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-cyan/25 border-t-cyan" />
    </div>
  );
}

/**
 * `/world` — Explore: the journey of worlds as floating islands. Selection is
 * local UI state; entering a world opens its adventure map
 * (`/world/:worldId`, `features/adventure-map`). All progress is derived
 * from the level store.
 */
export default function WorldMapPage() {
  const progress = useLevelStore((s) => s.progress);
  const summaries = useMemo(() => summarizeWorlds(progress), [progress]);
  const current = useMemo(() => currentWorld(summaries), [summaries]);
  const { selectedId, hoveredId, select, hover } = useWorldMapStore();
  const width = useViewportWidth();
  const narrow = width < 1360;

  // The first visit selects the current world.
  useEffect(() => {
    if (!useWorldMapStore.getState().selectedId) select(current.world.id);
  }, [current.world.id, select]);

  const selected = summaries.find((s) => s.world.id === selectedId) ?? null;
  const islands: IslandView[] = useMemo(
    () =>
      summaries.map((s) => ({
        summary: s,
        selected: s.world.id === selectedId,
        hovered: s.world.id === hoveredId,
        current: s.world.id === current.world.id,
        placement: journeyPlacement(s.world.order, summaries.length),
      })),
    [summaries, selectedId, hoveredId, current.world.id],
  );
  const segments = useMemo(() => pathSegments(summaries, selectedId), [summaries, selectedId]);

  const panelOpen = !!selected;
  const insets: MapInsets = {
    left: (narrow ? RAIL.narrow : RAIL.wide) + GAP * 2,
    right: panelOpen ? (narrow ? PANEL.narrow : PANEL.wide) + GAP * 2 : 0,
  };

  const onSelect = useCallback((id: string) => select(id), [select]);

  // Esc clears the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  return (
    <main className="relative min-h-0 flex-1 overflow-hidden bg-[#060d24] animate-page-in" aria-label="World map">
      <ErrorBoundary title="The world map could not be shown">
        <Suspense fallback={<MapLoading />}>
          <div className="absolute inset-0">
            <WorldMapCanvas
              islands={islands}
              segments={segments}
              insets={insets}
              onSelect={onSelect}
              onHover={hover}
              onBackgroundClick={() => select(null)}
            />
          </div>
        </Suspense>
      </ErrorBoundary>

      {/* Soft vignette: depth without extra geometry. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,transparent_45%,rgb(3_7_22/0.55)_100%)]" />
      <MapLabels islands={islands} onSelect={onSelect} onHover={hover} />

      {/* Overlays: pointer-events only on the panels themselves. */}
      <div className="pointer-events-none absolute inset-0 flex items-stretch justify-between gap-4 p-4">
        <div className="flex min-h-0 flex-col">
          <WorldJourneyList summaries={summaries} selectedId={selectedId} currentId={current.world.id} collapsed={narrow} onSelect={onSelect} onHover={hover} />
        </div>
        <div className="flex min-h-0 flex-col" style={{ width: narrow ? PANEL.narrow : PANEL.wide }}>
          {selected && <WorldDetailPanel summary={selected} onEnter={() => navigate(paths.world(selected.world.id))} onClose={() => select(null)} />}
        </div>
      </div>

      <p className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full bg-[#0b1630]/70 px-4 py-2 text-[12px] text-[#9fb0cc] backdrop-blur-md max-[1180px]:hidden">
        <span className="flex items-center gap-1.5">
          <MousePointerClick size={14} /> Click a world
        </span>
        <span className="flex items-center gap-1.5">
          <Hand size={14} /> Drag to look around · scroll to zoom
        </span>
      </p>
    </main>
  );
}
