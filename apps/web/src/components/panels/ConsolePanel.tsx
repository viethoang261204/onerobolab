import { Eraser } from 'lucide-react';
import type { RuntimeValue } from '@robolab/shared';
import { useProgramStore } from '../../features/programming/state/program-store';
import { useRuntimeStore } from '../../features/simulator/runtime/runtime-store';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { useConsoleStore } from '../../stores/console-store';
import { useSimulationStore } from '../../stores/simulation-store';
import { useUiStore } from '../../stores/ui-store';
import type { LogLevel, OutputTab, SimStatus } from '../../types/ui';
import { cn } from '../../utils/cn';
import { formatClock } from '../../utils/format';
import { StatusIndicator, type StatusTone } from '../common/StatusIndicator';
import { Tabs, type TabOption } from '../common/Tabs';

const TABS: readonly TabOption<OutputTab>[] = [
  { value: 'console', label: 'Console' },
  { value: 'variables', label: 'Variables' },
];

const LEVEL: Record<LogLevel, { tag: string; className: string }> = {
  info: { tag: 'INFO', className: 'text-[#93c5fd]' },
  success: { tag: 'DONE', className: 'text-success' },
  warn: { tag: 'WARN', className: 'text-warning' },
  error: { tag: 'ERR ', className: 'text-danger' },
};


function ConsoleLog() {
  const entries = useConsoleStore((s) => s.entries);
  const { ref, onScroll } = useAutoScroll<HTMLDivElement>(entries);

  return (
    <div ref={ref} onScroll={onScroll} className="h-full overflow-y-auto px-4 py-3 font-mono text-[13.5px] leading-[24px]" role="log" aria-live="polite">
      {entries.length === 0 && <div className="text-faint">Console cleared.</div>}
      {entries.map((e) => (
        <div key={e.id} className="flex gap-3 animate-fade-in">
          <span className="shrink-0 text-faint/80">{formatClock(e.at)}</span>
          <span className={cn('shrink-0', LEVEL[e.level].className)}>[{LEVEL[e.level].tag}]</span>
          <span className={e.level === 'success' ? 'text-success' : 'text-[#dbe4f3]'}>{e.message}</span>
        </div>
      ))}
    </div>
  );
}

const fmt = (v: RuntimeValue | undefined) => (v === undefined ? '—' : typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v));

function Row({ name, type, value, live }: { name: string; type: string; value: string; live?: boolean }) {
  return (
    <tr>
      <td className="py-1.5 font-medium text-[#dbe4f3]">{name}</td>
      <td className="py-1.5 text-faint">{type}</td>
      <td className={cn('py-1.5 text-right font-mono', live ? 'text-cyan' : 'text-muted')}>{value}</td>
    </tr>
  );
}

/** Live program variables and sensor values (throttled runtime snapshots). */
function VariablesTable() {
  const names = useProgramStore((s) => s.program.variables);
  const values = useRuntimeStore((s) => s.variables);
  const sensors = useRuntimeStore((s) => s.sensors);
  const speed = useRuntimeStore((s) => s.speed);
  const running = useRuntimeStore((s) => s.runState !== 'idle');
  return (
    <div className="h-full overflow-y-auto px-4 py-2">
      <table className="w-full text-[13px]">
        <tbody className="divide-y divide-white/5">
          {names.map((v) => (
            <Row key={v} name={v} type="variable" value={running ? fmt(values[v]) : '0'} live={running} />
          ))}
          {names.length === 0 && (
            <tr>
              <td colSpan={3} className="py-1.5 text-muted">
                No variables yet — create one with a “set” block.
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={3} className="pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
              Sensors
            </td>
          </tr>
          <Row name="distance" type="cm" value={sensors.distance === null ? 'nothing' : String(Math.round(sensors.distance * 100))} live />
          <Row name="line" type="yes/no" value={String(sensors.line)} live />
          <Row name="line offset" type="cm" value={sensors.lineOffset === null ? '—' : (sensors.lineOffset * 100).toFixed(1)} live />
          <Row name="obstacle" type="yes/no" value={String(sensors.obstacle)} live />
          <Row name="color" type="floor" value={sensors.color} live />
          <Row name="touch" type="yes/no" value={String(sensors.touch)} live />
          <Row name="speed" type="%" value={String(Math.round(speed * 100))} live />
        </tbody>
      </table>
    </div>
  );
}

const STATUS: Record<SimStatus, { tone: StatusTone; label: string }> = {
  idle: { tone: 'idle', label: 'Ready' },
  running: { tone: 'success', label: 'Running' },
  stopped: { tone: 'warning', label: 'Stopped' },
  finished: { tone: 'info', label: 'Finished' },
  error: { tone: 'danger', label: 'Error' },
};

/** Console / Variables output under the code editor. */
export function ConsolePanel() {
  const tab = useUiStore((s) => s.outputTab);
  const setTab = useUiStore((s) => s.setOutputTab);
  const clear = useConsoleStore((s) => s.clear);
  const status = useSimulationStore((s) => s.status);

  return (
    <section aria-label="Output" className="flex h-full min-h-0 flex-col">
      <div className="flex items-end justify-between">
        <Tabs label="Output view" value={tab} options={TABS} onChange={setTab} />
        <div className="flex items-center gap-3 pb-1.5">
          <StatusIndicator tone={STATUS[status].tone} label={STATUS[status].label} pulse={status === 'running'} />
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[14px] text-muted transition-colors hover:text-text"
          >
            <Eraser size={15} />
            Clear
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 rounded-[14px] rounded-tl-none border border-white/6 bg-[#08111f]">
        {tab === 'console' ? <ConsoleLog /> : <VariablesTable />}
      </div>
    </section>
  );
}
