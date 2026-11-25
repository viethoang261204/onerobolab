import { LoaderCircle, Play, RotateCcw, Square } from 'lucide-react';
import { useMessages } from '../../features/i18n/i18n';
import { useSimulationStore } from '../../stores/simulation-store';
import { cn } from '../../utils/cn';
import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { simulatorMessages } from './simulator.messages';

/**
 * Run / Stop / Reset robot. Actions go through the simulation store (never to
 * physics directly). "Reset" resets the robot only — the program and level
 * progress are untouched. Below 1024 px it is a full-width bar of big
 * (48 px) buttons at the bottom of the screen, within thumb reach.
 */
export function SimulationControls() {
  const m = useMessages(simulatorMessages);
  const status = useSimulationStore((s) => s.status);
  const run = useSimulationStore((s) => s.run);
  const stop = useSimulationStore((s) => s.stop);
  const reset = useSimulationStore((s) => s.reset);
  const running = status === 'running';

  return (
    <div data-tour="run" className="glass flex items-center gap-2 rounded-[var(--radius-panel)] p-2 max-lg:w-full lg:gap-2.5" role="toolbar" aria-label={m.controlsAria}>
      <Tooltip label={m.runTip} shortcut="Space">
        <Button variant="run" icon={running ? undefined : Play} iconFilled onClick={run} disabled={running} className={cn('max-lg:min-h-12 max-lg:flex-[1.3] lg:w-[112px]', running && 'disabled:opacity-100')}>
          {running && <LoaderCircle size={17} strokeWidth={2.4} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {running ? m.running : m.run}
        </Button>
      </Tooltip>
      <Tooltip label={m.stopTip} shortcut="Space">
        <Button variant="stop" icon={Square} iconFilled onClick={stop} disabled={!running} className="max-lg:min-h-12 max-lg:flex-1 lg:w-[104px]">
          {m.stop}
        </Button>
      </Tooltip>
      <Tooltip label={m.resetTip} shortcut="R">
        <Button variant="reset" icon={RotateCcw} onClick={reset} className="max-lg:min-h-12 max-lg:flex-1 lg:w-[104px]">
          {m.reset}
        </Button>
      </Tooltip>
    </div>
  );
}
