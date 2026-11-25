import { Activity, ChevronDown, ChevronUp, Compass, Palette, Radar, Timer } from 'lucide-react';
import { useState } from 'react';
import { blockName } from '@robolab/blocks';
import { useProgramStore } from '../../features/programming/state/program-store';
import { useRuntimeStore } from '../../features/simulator/runtime/runtime-store';
import { useSimulationStore } from '../../stores/simulation-store';
import type { SimStatus } from '../../types/ui';
import { cn } from '../../utils/cn';

const STATUS: Record<SimStatus, { label: string; tone: string }> = {
  idle: { label: 'Ready', tone: 'bg-white/40' },
  running: { label: 'Running', tone: 'bg-success animate-pulse' },
  stopped: { label: 'Stopped', tone: 'bg-warning' },
  finished: { label: 'Finished', tone: 'bg-cyan' },
  error: { label: 'Stopped — problem', tone: 'bg-danger' },
};

/** Compact robot status (bottom-left): run state, current block, time, heading, sensors. */
export function Telemetry() {
  const [open, setOpen] = useState(true);
  const status = useSimulationStore((s) => s.status);
  const time = useRuntimeStore((s) => s.time);
  const pose = useRuntimeStore((s) => s.pose);
  const sensors = useRuntimeStore((s) => s.sensors);
  const active = useRuntimeStore((s) => s.activeBlockId);
  const activeType = useProgramStore((s) => (active ? s.program.blocks[active]?.type : undefined));
  const deg = Math.round((((pose.heading * 180) / Math.PI) % 360 + 360) % 360);
  const items = [
    { icon: Timer, label: 'Time', value: `${time.toFixed(1)} s` },
    { icon: Compass, label: 'Heading', value: `${deg}°` },
    { icon: Radar, label: 'Distance', value: sensors.distance === null ? '—' : `${Math.round(sensors.distance * 100)} cm`, warn: sensors.obstacle },
    { icon: Palette, label: 'Floor', value: sensors.line ? 'line' : sensors.color === 'none' ? '—' : sensors.color },
  ];
  return (
    <section aria-label="Robot status" className="glass w-[300px] rounded-[var(--radius-panel)] px-3.5 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Collapse robot status' : 'Expand robot status'}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
          <span className={cn('h-2 w-2 rounded-full', STATUS[status].tone)} /> Rover · {STATUS[status].label}
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <Activity size={14} />
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
      </button>
      {open && (
        <>
          <div className="mt-1 truncate text-[12px] text-muted">{activeType ? <>Running: <span className="font-semibold text-cyan">{blockName(activeType)}</span></> : 'Waiting for Run'}</div>
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
