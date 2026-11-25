import { ArrowLeft } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { START_ID } from '@robolab/blocks';
import { useMessages } from '../../i18n/i18n';
import { programmingMessages } from '../programming.messages';
import { useProgramStore } from '../state/program-store';
import { StackView } from './BlockInstance';
import { cancelActiveDrag } from './drag-controller';
import { WorkspaceControls } from './WorkspaceControls';
import { workspaceRegistry } from './workspace-registry';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.6;
const GRID = 22;
const HOME = { x: 0, y: 0, zoom: 1 };

interface View {
  x: number;
  y: number;
  zoom: number;
}

interface Pt {
  x: number;
  y: number;
}

/** One stack placed on the workspace at its stored position. */
const RootStack = memo(function RootStack({ id }: { id: string }) {
  const pos = useProgramStore(useShallow((s) => s.program.roots.find((r) => r.id === id) ?? null));
  if (!pos) return null;
  return (
    <div className="absolute" style={{ left: pos.x, top: pos.y }}>
      <StackView headId={id} />
    </div>
  );
});

/**
 * Pannable / zoomable block canvas.
 *   wheel            → scroll (Shift = sideways)
 *   Ctrl/⌘ + wheel   → zoom at the cursor (also trackpad pinch)
 *   drag background, middle mouse, or Space + drag → pan
 *   two-finger pinch / pan (touch) → zoom + pan smoothly around finger midpoint
 * The view transform is applied straight to the DOM (no React re-render).
 */
export function BlockWorkspace() {
  const m = useMessages(programmingMessages);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ ...HOME });
  const [zoomLabel, setZoomLabel] = useState(100);
  const rootIds = useProgramStore(useShallow((s) => s.program.roots.map((r) => r.id)));
  const onlyStart = useProgramStore((s) => s.program.blocks[START_ID]?.next === null && s.program.roots.length === 1);
  const spaceDown = useRef(false);

  // Active touch pointers for pinch-zoom & two-finger pan, plus optional active 1-finger pan cleanup.
  const touchPointers = useRef(new Map<number, Pt>());
  const pinchState = useRef<{ dist: number; mid: Pt } | null>(null);
  const cancelSinglePan = useRef<(() => void) | null>(null);

  const apply = useCallback(() => {
    const v = view.current;
    if (content.current) content.current.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
    if (viewport.current) {
      viewport.current.style.backgroundPosition = `${v.x}px ${v.y}px`;
      viewport.current.style.backgroundSize = `${GRID * v.zoom}px ${GRID * v.zoom}px`;
    }
  }, []);

  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const el = viewport.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = (clientX ?? r.left + r.width / 2) - r.left;
      const cy = (clientY ?? r.top + r.height / 2) - r.top;
      const v = view.current;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
      // keep the point under the cursor fixed
      v.x = cx - ((cx - v.x) / v.zoom) * zoom;
      v.y = cy - ((cy - v.y) / v.zoom) * zoom;
      v.zoom = zoom;
      apply();
      setZoomLabel(Math.round(zoom * 100));
    },
    [apply],
  );

  const resetView = useCallback(() => {
    view.current = { ...HOME };
    apply();
    setZoomLabel(100);
  }, [apply]);

  // Register the handle for drags that start outside (toolbox) and for shortcuts.
  useEffect(() => {
    const vp = viewport.current;
    const ct = content.current;
    if (!vp || !ct) return;
    workspaceRegistry.set({
      viewport: vp,
      content: ct,
      zoom: () => view.current.zoom,
      toContent: (x, y) => {
        const r = vp.getBoundingClientRect();
        const v = view.current;
        return { x: (x - r.left - v.x) / v.zoom, y: (y - r.top - v.y) / v.zoom };
      },
      reveal: (x, y) => {
        const r = vp.getBoundingClientRect();
        const v = view.current;
        const sx = x * v.zoom + v.x;
        const sy = y * v.zoom + v.y;
        if (sx < 0 || sx > r.width - 40) v.x = 40 - x * v.zoom;
        if (sy < 0 || sy > r.height - 40) v.y = 40 - y * v.zoom;
        apply();
      },
    });
    apply();
    return () => workspaceRegistry.set(null);
  }, [apply]);

  // Wheel must be non-passive to prevent page scroll / browser zoom.
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
      } else {
        const v = view.current;
        v.x -= e.shiftKey ? e.deltaY : e.deltaX;
        v.y -= e.shiftKey ? 0 : e.deltaY;
        apply();
      }
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [apply, zoomAt]);

  // Global touch-pointer tracker for two-finger pinch-zoom & pan.
  useEffect(() => {
    const measure = () => {
      const pts = [...touchPointers.current.values()];
      if (pts.length < 2) return null;
      const [a, b] = pts as [Pt, Pt];
      return {
        dist: Math.hypot(b.x - a.x, b.y - a.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    };

    const onMove = (ev: PointerEvent) => {
      if (!touchPointers.current.has(ev.pointerId)) return;
      touchPointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (touchPointers.current.size < 2) return;
      const next = measure();
      if (!next) return;
      const prev = pinchState.current;
      pinchState.current = next;
      if (!prev) return;
      const vp = viewport.current;
      if (!vp) return;
      const r = vp.getBoundingClientRect();
      const v = view.current;
      // Pan with the midpoint movement
      v.x += next.mid.x - prev.mid.x;
      v.y += next.mid.y - prev.mid.y;
      // Pinch-zoom around the current midpoint
      if (prev.dist > 10 && next.dist > 10) {
        const factor = next.dist / prev.dist;
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
        const cx = next.mid.x - r.left;
        const cy = next.mid.y - r.top;
        v.x = cx - ((cx - v.x) / v.zoom) * zoom;
        v.y = cy - ((cy - v.y) / v.zoom) * zoom;
        v.zoom = zoom;
        setZoomLabel(Math.round(zoom * 100));
      }
      apply();
    };

    const onEnd = (ev: PointerEvent) => {
      if (!touchPointers.current.delete(ev.pointerId)) return;
      if (touchPointers.current.size < 2) pinchState.current = null;
      else pinchState.current = measure();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [apply]);

  // Space + drag pans (only while the pointer is over the workspace).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) && viewport.current?.matches(':hover')) {
        spaceDown.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const onPointerDownCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    touchPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touchPointers.current.size >= 2) {
      // Transition cleanly from any single-finger drag/pan into two-finger pinch & pan.
      cancelActiveDrag();
      cancelSinglePan.current?.();
      const pts = [...touchPointers.current.values()] as [Pt, Pt];
      pinchState.current = {
        dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      };
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (touchPointers.current.size >= 2) return;
    const onBackground = e.target === viewport.current || e.target === content.current;
    const pan = e.button === 1 || (e.button === 0 && (onBackground || spaceDown.current));
    if (!pan) return;
    e.preventDefault();
    const pointerId = e.pointerId;
    const start = { x: e.clientX, y: e.clientY, vx: view.current.x, vy: view.current.y };
    let moved = false;
    viewport.current?.classList.add('cursor-grabbing');
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 3) moved = true;
      view.current.x = start.vx + ev.clientX - start.x;
      view.current.y = start.vy + ev.clientY - start.y;
      apply();
    };
    const cleanup = (deselect: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (cancelSinglePan.current === abort) cancelSinglePan.current = null;
      viewport.current?.classList.remove('cursor-grabbing');
      if (deselect && !moved && onBackground) useProgramStore.getState().select(null);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup(true);
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup(false);
    };
    const abort = () => cleanup(false);
    cancelSinglePan.current = abort;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-[14px] border border-white/6 bg-[#0a1424]">
      <div
        ref={viewport}
        onPointerDownCapture={onPointerDownCapture}
        onPointerDown={onPointerDown}
        className="absolute inset-0 cursor-default touch-none select-none"
        style={{ backgroundImage: 'radial-gradient(rgb(148 163 184 / 0.14) 1px, transparent 1.3px)' }}
      >
        <div ref={content} className="absolute left-0 top-0 origin-top-left">
          {rootIds.map((id) => (
            <RootStack key={id} id={id} />
          ))}
        </div>
      </div>

      {onlyStart && (
        <div className="pointer-events-none absolute inset-x-0 top-[118px] flex animate-fade-in items-center justify-center gap-3 px-4">
          <ArrowLeft size={22} className="hidden shrink-0 animate-nudge-left text-cyan/80 sm:block" aria-hidden="true" />
          <div className="max-w-[260px] rounded-[var(--radius-panel)] border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-center text-[12.5px] leading-relaxed text-muted">
            <div className="mb-0.5 font-semibold text-[#e2e8f0]">{m.emptyWorkspaceTitle}</div>
            {m.emptyWorkspaceSubPrefix}
            <span className="font-semibold text-[#fcd34d]">{m.emptyWorkspaceStartName}</span>
            {m.emptyWorkspaceSubSuffix}
          </div>
        </div>
      )}

      <WorkspaceControls zoom={zoomLabel} onZoomIn={() => zoomAt(1.2)} onZoomOut={() => zoomAt(1 / 1.2)} onReset={resetView} />
    </div>
  );
}
