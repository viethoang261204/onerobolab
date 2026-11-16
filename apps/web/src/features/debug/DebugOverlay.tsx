import { radToDeg } from '@robolab/shared';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUiStore } from '../../stores/ui-store';
import { useLevelStore } from '../levels/level-store';
import { useSettingsStore } from '../settings/settings-store';
import { useRuntimeStore } from '../simulator/runtime/runtime-store';

/**
 * Developer-only overlay (Settings → Developer overlay, or Ctrl+Shift+D in
 * dev builds). Polls at 4 Hz; never shown to students in production builds.
 */
export function DebugOverlay() {
  const enabled = useSettingsStore((s) => s.debug) && import.meta.env.DEV;
  const [open, setOpen] = useState(true);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [enabled]);
  if (!enabled) return null;

  const r = useRuntimeStore.getState();
  const info = window.__onerobolabRenderInfo;
  const rows: [string, string][] = [
    ['FPS', String(useUiStore.getState().fps)],
    ['draw calls', String(info?.calls ?? '—')],
    ['triangles', info ? info.triangles.toLocaleString() : '—'],
    ['geometries / textures', info ? `${info.geometries} / ${info.textures}` : '—'],
    ['level', useLevelStore.getState().levelId],
    ['runtime', `${r.runState} · ${r.mode}`],
    ['time', `${r.time.toFixed(2)} s`],
    ['pose', `x ${r.pose.x.toFixed(3)}  z ${r.pose.z.toFixed(3)}`],
    ['heading', `${radToDeg(r.pose.heading).toFixed(1)}°`],
    ['active block', r.activeBlockId ?? '—'],
    ['distance', r.sensors.distance === null ? '—' : `${r.sensors.distance.toFixed(3)} m`],
    ['line / offset', `${r.sensors.line} / ${r.sensors.lineOffset?.toFixed(3) ?? '—'}`],
    ['obstacle / touch', `${r.sensors.obstacle} / ${r.sensors.touch}`],
    ['mission', r.mission ? `${r.mission.status} · ${r.mission.objectives.filter((o) => o.completed).length}/${r.mission.objectives.length}` : '—'],
  ];
  return (
    <div className="pointer-events-auto fixed bottom-4 left-[328px] z-[15] rounded-lg border border-white/10 bg-black/85 px-3 py-2 font-mono text-[11px] text-[#a7f3d0] shadow-lg max-[900px]:left-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-white/60 hover:text-white"
      >
        <span>Debug · {r.pose.x.toFixed(1)}, {r.pose.z.toFixed(1)}</span>
        {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>
      {open && (
        <div className="mt-1.5 grid grid-cols-[auto_auto] gap-x-4 border-t border-white/10 pt-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <span className="text-white/45">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
