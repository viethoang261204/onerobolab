import { Eraser } from 'lucide-react';
import type { RuntimeValue } from '@robolab/shared';
import { useLocale, useMessages } from '../../features/i18n/i18n';
import { COLOR_LABELS_VI } from '../../features/programming/blocks-vi';
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
import { consolePanelMessages } from './console-panel.messages';

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: 'text-[#93c5fd]',
  success: 'text-success',
  warn: 'text-warning',
  error: 'text-danger',
};

function ConsoleLog() {
  const m = useMessages(consolePanelMessages);
  const entries = useConsoleStore((s) => s.entries);
  const { ref, onScroll } = useAutoScroll<HTMLDivElement>(entries);
  const tagFor: Record<LogLevel, string> = {
    info: m.tagInfo,
    success: m.tagDone,
    warn: m.tagWarn,
    error: m.tagErr,
  };

  return (
    <div ref={ref} onScroll={onScroll} className="h-full overflow-y-auto px-3 py-2.5 font-mono text-[13px] leading-[22px] sm:px-4 sm:py-3 sm:text-[13.5px] sm:leading-[24px]" role="log" aria-live="polite">
      {entries.length === 0 && <div className="text-faint">{m.consoleCleared}</div>}
      {entries.map((e) => (
        <div key={e.id} className="flex gap-2.5 animate-fade-in sm:gap-3">
          <span className="shrink-0 text-faint/80">{formatClock(e.at)}</span>
          <span className={cn('shrink-0', LEVEL_CLASS[e.level])}>[{tagFor[e.level]}]</span>
          <span className={cn('min-w-0 break-words', e.level === 'success' ? 'text-success' : 'text-[#dbe4f3]')}>{e.message}</span>
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
  const m = useMessages(consolePanelMessages);
  const locale = useLocale();
  const names = useProgramStore((s) => s.program.variables);
  const values = useRuntimeStore((s) => s.variables);
  const sensors = useRuntimeStore((s) => s.sensors);
  const speed = useRuntimeStore((s) => s.speed);
  const running = useRuntimeStore((s) => s.runState !== 'idle');
  const boolText = (b: boolean) => (b ? m.valTrue : m.valFalse);
  const colorText = locale === 'vi' ? (COLOR_LABELS_VI[sensors.color] ?? sensors.color) : sensors.color;
  return (
    <div className="h-full overflow-y-auto px-3 py-2 sm:px-4">
      <table className="w-full text-[13px]">
        <tbody className="divide-y divide-white/5">
          {names.map((v) => (
            <Row key={v} name={v} type={m.typeVariable} value={running ? fmt(values[v]) : '0'} live={running} />
          ))}
          {names.length === 0 && (
            <tr>
              <td colSpan={3} className="py-1.5 text-muted">
                {m.noVariables}
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={3} className="pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
              {m.sensorsHeading}
            </td>
          </tr>
          <Row name={m.sensorDistance} type="cm" value={sensors.distance === null ? m.valNothing : String(Math.round(sensors.distance * 100))} live />
          <Row name={m.sensorLine} type={m.unitYesNo} value={boolText(sensors.line)} live />
          <Row name={m.sensorLineOffset} type="cm" value={sensors.lineOffset === null ? '—' : (sensors.lineOffset * 100).toFixed(1)} live />
          <Row name={m.sensorObstacle} type={m.unitYesNo} value={boolText(sensors.obstacle)} live />
          <Row name={m.sensorColor} type={m.unitFloor} value={colorText} live />
          <Row name={m.sensorTouch} type={m.unitYesNo} value={boolText(sensors.touch)} live />
          <Row name={m.sensorSpeed} type="%" value={String(Math.round(speed * 100))} live />
        </tbody>
      </table>
    </div>
  );
}

const STATUS_TONE: Record<SimStatus, StatusTone> = {
  idle: 'idle',
  running: 'success',
  stopped: 'warning',
  finished: 'info',
  error: 'danger',
};

/** Console / Variables output under the code editor. */
export function ConsolePanel() {
  const m = useMessages(consolePanelMessages);
  const tab = useUiStore((s) => s.outputTab);
  const setTab = useUiStore((s) => s.setOutputTab);
  const clear = useConsoleStore((s) => s.clear);
  const status = useSimulationStore((s) => s.status);

  const tabs: readonly TabOption<OutputTab>[] = [
    { value: 'console', label: m.tabConsole },
    { value: 'variables', label: m.tabVariables },
  ];
  const statusLabel: Record<SimStatus, string> = {
    idle: m.statusIdle,
    running: m.statusRunning,
    stopped: m.statusStopped,
    finished: m.statusFinished,
    error: m.statusError,
  };

  return (
    <section aria-label={m.outputAria} className="flex h-full min-h-0 flex-col">
      <div className="flex items-end justify-between gap-2">
        <Tabs label={m.outputViewAria} value={tab} options={tabs} onChange={setTab} />
        <div className="flex items-center gap-2 pb-1 sm:gap-3 sm:pb-1.5">
          <StatusIndicator tone={STATUS_TONE[status]} label={statusLabel[status]} pulse={status === 'running'} />
          <button
            type="button"
            onClick={clear}
            className="flex min-h-[36px] items-center gap-1.5 rounded-md px-2 py-1 text-[13.5px] text-muted transition-colors hover:bg-white/[0.06] hover:text-text sm:text-[14px]"
          >
            <Eraser size={15} />
            {m.clear}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 rounded-[14px] rounded-tl-none border border-white/6 bg-[#08111f]">
        {tab === 'console' ? <ConsoleLog /> : <VariablesTable />}
      </div>
    </section>
  );
}
