import { Activity, ChevronDown, ChevronUp, Compass, Palette, Radar, Timer } from 'lucide-react';
import { useState } from 'react';
import { blockName } from '@robolab/blocks';
import { useMessages } from '../../features/i18n/i18n';
import { useProgramStore } from '../../features/programming/state/program-store';
import { colorName } from '../../features/simulator/runtime/describe';
import { useRuntimeStore } from '../../features/simulator/runtime/runtime-store';
import { useSimulationStore } from '../../stores/simulation-store';
import type { SimStatus } from '../../types/ui';
import { cn } from '../../utils/cn';
import { simulatorMessages } from './simulator.messages';

const STATUS_TONE: Record<SimStatus, string> = {
  idle: 'bg-white/40',
  running: 'bg-success animate-pulse',
  stopped: 'bg-warning',
  finished: 'bg-cyan',
  error: 'bg-danger',
};

/** Compact robot status (bottom-left, desktop only): run state, current block, time, heading, sensors. */
export function Telemetry() {
  const m = useMessages(simulatorMessages);
  const [open, setOpen] = useState(true);
  const status = useSimulationStore((s) => s.status);
  const time = useRuntimeStore((s) => s.time);
  const pose = useRuntimeStore((s) => s.pose);
  const sensors = useRuntimeStore((s) => s.sensors);
  const active = useRuntimeStore((s) => s.activeBlockId);
  const activeType = useProgramStore((s) => (active ? s.program.blocks[active]?.type : undefined));
  const deg = Math.round((((pose.heading * 180) / Math.PI) % 360 + 360) % 360);
  const statusLabel = { idle: m.statusReady, running: m.statusRunning, stopped: m.statusStopped, finished: m.statusFinished, error: m.statusError }[status];
  const items = [
    { icon: Timer, label: m.time, value: `${time.toFixed(1)} s` },
    { icon: Compass, label: m.heading, value: `${deg}°` },
    { icon: Radar, label: m.distance, value: sensors.distance === null ? '—' : `${Math.round(sensors.distance * 100)} cm`, warn: sensors.obstacle },
    { icon: Palette, label: m.floor, value: sensors.line ? m.floorLine : sensors.color === 'none' ? '—' : colorName(sensors.color) },
  ];
  return (
    <section aria-label={m.robotStatus} className="glass w-[300px] rounded-[var(--radius-panel)] px-3.5 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? m.collapseStatus : m.expandStatus}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
          <span className={cn('h-2 w-2 rounded-full', STATUS_TONE[status])} /> {m.rover} · {statusLabel}
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <Activity size={14} />
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
      </button>
      {open && (
        <>
          <div className="mt-1 truncate text-[12px] text-muted">{activeType ? <>{m.runningBlock} <span className="font-semibold text-cyan">{blockName(activeType)}</span></> : m.waitingRun}</div>
          <dl className="mt-2.5 grid grid-cols-4 gap-1.5">
            {items.map(({ icon: Icon, label, value, warn }) => (
              <div key={label} className={cn('rounded-[10px] bg-white/[0.04] px-1.5 py-1.5 text-center', warn && 'bg-danger/15')}>
                <dt className="flex items-center justify-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-faint">
                  <Icon size={10} /> {label}
                </dt>
                <dd className={cn('tabular mt-0.5 truncate text-[12.5px] font-bold', warn ? 'text-[#fca5a5]' : 'text-white')}>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
