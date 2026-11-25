import { Crosshair, Maximize2, Minus, Plus } from 'lucide-react';
import { lazy, Suspense, useMemo, useRef, type FocusEvent, type ReactNode } from 'react';
import { useMessages } from '../../i18n/i18n';
import { registerAnchor } from '../../world-map/scene/screen-anchors';
import { adventureMapMessages } from '../adventure-map.messages';
import type { AdventureLayout, AdventureView, StopView } from '../adventure.types';
import { islandLandmarks } from '../island/island-landmarks';
import { islandGround } from '../island/island-terrain';
import { ISLAND_THEMES } from '../island/island-theme';
import type { CameraHandle } from '../scene3d/CameraRig';
import { ChallengeNode, CheckpointNode, GateNode, LevelNode } from './nodes';

const AdventureCanvas = lazy(() => import('../scene3d/AdventureCanvas'));

interface WorldMapProps {
  worldName: string;
  layout: AdventureLayout;
  view: AdventureView;
  selectedId: string | null;
  onOpen: (stop: StopView) => void;
  /** Camera controls for the page (sidebar "Continue"). */
  camera: CameraHandle;
  /** HUD width on the left (px). */
  inset: number;
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex h-11 w-11 items-center justify-center text-[#cbd5e1] transition-colors duration-[var(--dur-fast)] hover:bg-white/10 hover:text-white">
      {children}
    </button>
  );
}

/** A DOM element pinned to a 3D point (projected by the canvas each frame). */
function Anchor({ id, at, children }: { id: string; at: readonly [number, number, number]; children: ReactNode }) {
  return (
    <div ref={(el) => registerAnchor(`adv:${id}`, el, { x: at[0], y: at[1], z: at[2] })} className="invisible absolute left-0 top-0 will-change-transform">
      {children}
    </div>
  );
}

/**
 * One world's adventure island: the 3D scene (lazy) with the mission
 * markers pinned on it, camera controls and keyboard support. The camera
 * opens on the student's current mission.
 */
export function WorldMap({ worldName, layout, view, selectedId, onOpen, camera, inset }: WorldMapProps) {
  const m = useMessages(adventureMapMessages);
  const surface = useRef<HTMLDivElement>(null);
  const ground = useMemo(() => islandGround(layout), [layout]);
  const marks = useMemo(() => islandLandmarks(layout, ground), [layout, ground]);
  const heights = useMemo(() => new Map([...layout.main, ...layout.challenges].map((s) => [s.def.id, s.h])), [layout]);
  const byId = useMemo(() => new Map(view.stops.map((s) => [s.id, s])), [view.stops]);
  const theme = ISLAND_THEMES[layout.theme];

  const anchorOf = (s: StopView): readonly [number, number, number] => {
    if (s.kind === 'gate') {
      const g = marks.gates.find((x) => x.stopId === s.id);
      if (g) return [g.x, g.y + 3.2, g.z];
    }
    if (s.kind === 'checkpoint') {
      const st = marks.stations.get(s.id);
      if (st) return [st.x, st.y + 2.4, st.z];
    }
    const h = heights.get(s.id) ?? 0;
    return [s.pos.x, h + (s.kind === 'final' ? 1.3 : 1.0), s.pos.y];
  };

  // Keyboard users: bring a focused marker into view.
  const onFocusMarker = (e: FocusEvent<HTMLDivElement>) => {
    const id = (e.target as HTMLElement).dataset.stop;
    const stop = id ? byId.get(id) : undefined;
    if (stop && (e.target as HTMLElement).matches(':focus-visible')) camera.current?.focus(stop.pos);
  };

  return (
    <div
      ref={surface}
      tabIndex={0}
      role="region"
      aria-label={m.mapRegionAria({ worldName })}
      className="adv-viewport relative h-full w-full touch-none select-none overflow-hidden outline-none"
      style={{ background: `linear-gradient(${theme.sky.top}, ${theme.sky.fog})` }}
    >
      <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center" role="status" aria-label={m.loadingWorld}><span className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-white" /></div>}>
        <div className="absolute inset-0">
          <AdventureCanvas key={layout.seed} layout={layout} ground={ground} marks={marks} view={view} surface={surface} camera={camera} inset={inset} />
        </div>
      </Suspense>

      <div className="adv-content pointer-events-none absolute inset-0 overflow-hidden" onFocus={onFocusMarker}>
        <Anchor id="start" at={[marks.startPad.x, marks.startPad.y + 1.5, marks.startPad.z]}>
          <span className="pointer-events-none flex -rotate-6 items-center rounded-[8px] border-2 border-white/80 bg-primary-strong px-3 py-0.5 font-display text-[15px] font-black tracking-wider text-white shadow-[0_6px_16px_-6px_rgb(0_0_0/0.8)]">{m.startBanner}</span>
        </Anchor>
        {view.stops.map((s) => {
          const props = { stop: s, selected: s.id === selectedId, onOpen };
          const node =
            s.kind === 'challenge' ? <ChallengeNode {...props} /> : s.kind === 'gate' ? <GateNode {...props} /> : s.kind === 'checkpoint' ? <CheckpointNode {...props} /> : <LevelNode {...props} />;
          return (
            <Anchor key={s.id} id={s.id} at={anchorOf(s)}>
              {node}
            </Anchor>
          );
        })}
      </div>

      <div className="glass absolute bottom-4 right-3 flex flex-col overflow-hidden rounded-[var(--radius-control)] sm:right-4" role="group" aria-label={m.mapControlsAria}>
        <ControlButton label={m.zoomIn} onClick={() => camera.current?.zoomBy(1.3)}>
          <Plus size={18} />
        </ControlButton>
        <ControlButton label={m.zoomOut} onClick={() => camera.current?.zoomBy(1 / 1.3)}>
          <Minus size={18} />
        </ControlButton>
        <span className="mx-2 h-px bg-white/10" />
        <ControlButton label={m.goToMyMission} onClick={() => camera.current?.focus(view.focus)}>
          <Crosshair size={18} />
        </ControlButton>
        <ControlButton label={m.showWholeIsland} onClick={() => camera.current?.overview()}>
          <Maximize2 size={17} />
        </ControlButton>
      </div>
    </div>
  );
}
